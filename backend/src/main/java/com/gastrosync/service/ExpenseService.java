package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.mapper.ExpenseMapper;
import com.gastrosync.model.Expense;
import com.gastrosync.model.ExpensePayment;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.repository.ExpensePaymentRepository;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Gider / tedarikci faturasi yasam dongusu.
 *
 * Meslek etigi ve ic kontrol kurallari:
 *  1. GOREVLER AYRILIGI (maker-checker): Gideri kaydeden kisi ayni gideri onaylayamaz.
 *  2. ONAY != ODEME: Onay harcama yetkisidir; odeme kasa/banka cikisidir ve ayri kaydedilir.
 *  3. BAGIMSIZ DENETIM: Muhasebe odedigi ve faturalandirdigi kaydi Mali Musavire gonderir; resmi deftere isleme
 *     (FINALIZED) veya gerekceli ret YALNIZCA Mali Musavir (SMMM) tarafindan yapilir. Yonetici bu islemleri
 *     izler ancak yapmaz; harcama onayi Isletme Muduru, odeme ve belge gonderimi Muhasebe isidir (Permissions).
 *     Dort goz: gideri kaydeden veya onaylayan kisi ayni gideri deftere isleyemez.
 *  4. BELGE DUZENI (VUK): Fatura/fis numarasi ve karsi taraf bilgisi olmayan gider deftere islenemez.
 *  5. DEGISTIRILEMEZLIK: Kesinlesmis kayit degistirilemez/silinemez; onaylanmis kayit once reddedilmelidir.
 *  6. GEREKCELI RET: Ret gerekcesi zorunludur ve denetim izine yazilir.
 *  7. DONEM KILIDI: Kapatilmis donemde kayit olusturulamaz ve degistirilemez.
 */
@Service
@Transactional(readOnly = true)
public class ExpenseService {

    private static final Set<Integer> VALID_VAT = Set.of(0, 1, 10, 20);
    private static final BigDecimal TOLERANCE = new BigDecimal("0.005");

    private final ExpenseRepository expenseRepository;
    private final ExpensePaymentRepository paymentRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final ExpenseMapper expenseMapper;
    private final AccountingPeriodService periodService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final ChatService chatService;
    private final boolean enforceSegregation;

    public ExpenseService(ExpenseRepository expenseRepository,
                          ExpensePaymentRepository paymentRepository,
                          InventoryItemRepository inventoryItemRepository,
                          ExpenseMapper expenseMapper,
                          AccountingPeriodService periodService,
                          NotificationService notificationService,
                          AuditService auditService,
                          CurrentUserService currentUserService,
                          ChatService chatService,
                          @Value("${gastrosync.accounting.enforce-segregation:true}") boolean enforceSegregation) {
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.expenseMapper = expenseMapper;
        this.periodService = periodService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.chatService = chatService;
        this.enforceSegregation = enforceSegregation;
    }

    // ── Sorgular ────────────────────────────────────────────────

    public List<ExpenseResponse> getAllExpenses() {
        return expenseMapper.toDtoList(expenseRepository.findAllByOrderByExpenseDateDescIdDesc());
    }

    public List<ExpenseResponse> getExpensesByPeriod(String period) {
        return expenseMapper.toDtoList(expenseRepository.findByPeriodOrderByExpenseDateDescIdDesc(
                AccountingPeriodService.validatePeriod(period)));
    }

    public List<ExpenseResponse> getExpensesByCategory(String category) {
        return expenseMapper.toDtoList(expenseRepository.findByCategory(category.toUpperCase(Locale.ROOT)));
    }

    public ExpenseResponse getExpenseById(Long id) {
        return expenseMapper.toDto(find(id));
    }

    public List<ExpensePayment> getPayments(Long id) {
        find(id);
        return paymentRepository.findByExpenseIdOrderByCreatedAtAsc(id);
    }

    private Expense find(Long id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gider kaydi bulunamadi: ID " + id));
    }

    /** Savunma derinligi: controller disindan cagrilsa da rol izni servis katmaninda dogrulanir */
    private AuthenticatedUser requirePermission(Permissions.P permission, String message) {
        AuthenticatedUser actor = currentUserService.require();
        if (!currentUserService.can(permission)) throw new AccessDeniedException(message);
        return actor;
    }

    private Expense lock(Long id) {
        return expenseRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gider kaydi bulunamadi: ID " + id));
    }

    // ── Olusturma / duzeltme ───────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse createExpense(ExpenseCreateRequest request) {
        AuthenticatedUser actor = requirePermission(Permissions.P.EXPENSE_CREATE, "Gider / fatura kaydi Muhasebe yetkisindedir");
        Expense entity = new Expense();
        applyEditable(entity, request);
        periodService.assertOpen(entity.getPeriod());

        entity.setRecordedBy(actor.displayName());
        entity.setStatus(Expense.STATUS_PENDING);
        entity.setSentToAdvisor(false);
        entity.setRecordedInLedger(false);
        entity.setPaidAmount(BigDecimal.ZERO);
        entity.setInventoryItemId(request.getInventoryItemId());
        entity.setPurchaseQuantity(request.getPurchaseQuantity());
        entity.refreshPaymentStatus();
        Expense saved = expenseRepository.save(entity);

        // Pesin odenmis kucuk harcamalar (kasa fisi): yalnizca kasa yetkilileri odeme kaydi girebilir
        BigDecimal upfront = upfrontPayment(request, saved.getAmount());
        if (upfront.signum() > 0) {
            if (!currentUserService.can(Permissions.P.EXPENSE_PAY)) {
                throw new AccessDeniedException("Odeme kaydi yalnizca Muhasebe tarafindan girilebilir");
            }
            recordPayment(saved, upfront, normalizeMethod(request.getPaymentMethod()), "Kayit aninda pesin odeme");
        }

        auditService.log("EXPENSE_CREATED", "EXPENSE", saved.getId(), null, Expense.STATUS_PENDING,
                String.format("%s | %s TL | %s", saved.getTitle(), saved.getAmount().toPlainString(), saved.getSubType()));
        notificationService.notify(Permissions.rolesWith(Permissions.P.EXPENSE_APPROVE),
                "Onay Bekleyen Gider: " + saved.getTitle(),
                String.format("%s tarafindan '%s' (%s TL) kaydedildi ve onay bekliyor.", actor.displayName(),
                        saved.getTitle(), fmt(saved.getAmount())),
                actor.displayName(), "EXPENSE_PENDING", saved.getId(), "/approvals", "INFO");
        publishFinance("EXPENSE", saved.getId());
        return expenseMapper.toDto(saved);
    }

    private BigDecimal upfrontPayment(ExpenseCreateRequest req, BigDecimal amount) {
        String ps = req.getPaymentStatus() == null ? "" : req.getPaymentStatus().trim().toUpperCase(Locale.ROOT);
        if ("PAID".equals(ps)) return amount;
        if ("PARTIAL".equals(ps)) {
            BigDecimal p = req.getPaidAmount();
            if (p == null || p.signum() <= 0 || p.compareTo(amount) >= 0) {
                throw new IllegalArgumentException("Kismi odemede odenen tutar 0'dan buyuk ve toplamdan kucuk olmalidir");
            }
            return p.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO;
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse updateExpense(Long id, ExpenseCreateRequest request) {
        AuthenticatedUser actor = currentUserService.require();
        Expense existing = lock(id);
        if (existing.isFinalized()) {
            throw new BusinessRuleException("Resmi deftere islenmis ve kesinlesmis bir gider kaydi (FINALIZED) guncellenemez!");
        }
        if (Expense.STATUS_APPROVED.equals(existing.getStatus())) {
            throw new BusinessRuleException("Onaylanmis gider degistirilemez. Duzeltme gerekiyorsa once gerekceli olarak reddedilmelidir.");
        }
        if (!currentUserService.can(Permissions.P.EXPENSE_EDIT)) {
            throw new AccessDeniedException("Gider kaydini yalnizca Muhasebe duzeltebilir");
        }
        periodService.assertOpen(existing.getPeriod());
        String oldStatus = existing.getStatus();
        BigDecimal oldAmount = existing.getAmount();

        applyEditable(existing, request);
        periodService.assertOpen(existing.getPeriod());
        if (existing.getAmount().compareTo(existing.getPaidAmount()) < 0) {
            throw new BusinessRuleException("Gider tutari, yapilmis odemelerden (" + fmt(existing.getPaidAmount()) + " TL) az olamaz");
        }
        existing.refreshPaymentStatus();

        boolean resubmitted = Expense.STATUS_REJECTED.equals(oldStatus);
        if (resubmitted) {
            existing.setStatus(Expense.STATUS_PENDING);
            existing.setRejectionReason(null);
            existing.setSentToAdvisor(false);
        }
        Expense updated = expenseRepository.save(existing);
        auditService.log(resubmitted ? "EXPENSE_RESUBMITTED" : "EXPENSE_UPDATED", "EXPENSE", id, oldStatus, updated.getStatus(),
                "Tutar: " + fmt(oldAmount) + " -> " + fmt(updated.getAmount()));
        if (resubmitted) {
            notificationService.notify(Permissions.rolesWith(Permissions.P.EXPENSE_APPROVE),
                    "Duzeltilen Gider Tekrar Onayda: " + updated.getTitle(),
                    actor.displayName() + " reddedilen '" + updated.getTitle() + "' kaydini duzeltip tekrar onaya sundu.",
                    actor.displayName(), "EXPENSE_PENDING", id, "/approvals", "INFO");
        }
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(updated);
    }

    /** Durum/onay/odeme disindaki duzenlenebilir alanlar */
    private void applyEditable(Expense e, ExpenseCreateRequest r) {
        ExpenseCatalog.ExpenseType type = ExpenseCatalog.require(r.getSubType());
        String category = r.getCategory() == null ? type.defaultCategory() : r.getCategory().trim().toUpperCase(Locale.ROOT);
        if (!"FIXED".equals(category) && !"VARIABLE".equals(category)) {
            throw new IllegalArgumentException("Gider kategorisi FIXED veya VARIABLE olmalidir");
        }
        if (r.getAmount() == null || r.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Gider tutari 0'dan buyuk olmalidir");
        }
        LocalDate date = r.getExpenseDate() != null ? r.getExpenseDate() : LocalDate.now();
        if (date.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Belge (islem) tarihi ileri bir tarih olamaz; vadeyi 'Son odeme tarihi' alanina girin");
        }
        if (r.getDueDate() != null && r.getDueDate().isBefore(date)) {
            throw new IllegalArgumentException("Son odeme tarihi belge tarihinden once olamaz");
        }
        BigDecimal vat = r.getVatRate() != null ? r.getVatRate() : type.defaultVat();
        if (!VALID_VAT.contains(vat.intValue()) || vat.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("KDV orani 0, 1, 10 veya 20 olmalidir");
        }
        if ("TAX".equals(type.code())) vat = BigDecimal.ZERO;

        e.setTitle(r.getTitle().trim());
        e.setCategory(category);
        e.setSubType(type.code());
        e.setAmount(r.getAmount().setScale(2, RoundingMode.HALF_UP));
        e.setExpenseDate(date);
        e.setPeriod(Expense.periodOf(date));
        e.setDueDate(r.getDueDate() != null ? r.getDueDate() : date);
        e.setInvoiceNumber(blankToNull(r.getInvoiceNumber()));
        e.setCounterparty(blankToNull(r.getCounterparty()));
        e.setNote(blankToNull(r.getNote()));
        e.setVatRate(vat);
        e.setIsOwnedProperty(Boolean.TRUE.equals(r.getIsOwnedProperty()));
    }

    // ── Durum gecisleri ────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse approveExpense(Long id) {
        AuthenticatedUser actor = requirePermission(Permissions.P.EXPENSE_APPROVE, "Harcama onayi Isletme Muduru yetkisindedir");
        Expense e = lock(id);
        if (e.isFinalized()) {
            throw new BusinessRuleException("Resmi deftere islenmis ve kesinlesmis gider (FINALIZED) yeniden onaylanamaz.");
        }
        if (Expense.STATUS_APPROVED.equals(e.getStatus())) {
            throw new BusinessRuleException("Bu gider zaten onaylanmis.");
        }
        if (Expense.STATUS_REJECTED.equals(e.getStatus())) {
            throw new BusinessRuleException("Reddedilen gider once duzeltilip tekrar onaya sunulmalidir.");
        }
        if (enforceSegregation && actor.username().equalsIgnoreCase(e.getCreatedBy())) {
            throw new BusinessRuleException("Gorevler ayriligi ilkesi: Kendi kaydettiginiz gideri onaylayamazsiniz. "
                    + "Onay baska bir yetkili (Isletme Muduru) tarafindan verilmelidir.");
        }
        periodService.assertOpen(e.getPeriod());

        e.setStatus(Expense.STATUS_APPROVED);
        e.setApprovedBy(actor.displayName());
        e.setApprovedAt(LocalDateTime.now());
        // Mali Musavire gonderim ayri adimdir: muhasebe oder, belgeyi tamamlar ve gonderir
        e.setSentToAdvisor(false);
        e.setSubmittedBy(null);
        e.setSubmittedAt(null);
        e.setRejectionReason(null);
        Expense saved = expenseRepository.save(e);

        auditService.log("EXPENSE_APPROVED", "EXPENSE", id, Expense.STATUS_PENDING, Expense.STATUS_APPROVED, saved.getTitle());
        boolean unpaid = saved.getRemainingAmount().signum() > 0;
        boolean docMissing = saved.getInvoiceNumber() == null || saved.getCounterparty() == null;
        notificationService.notify(List.of(AppRoles.ACCOUNTANT),
                (unpaid ? "Odeme Bekliyor: " : "Musavire Gonderilecek: ") + saved.getTitle(),
                String.format("%s, '%s' (%s TL) giderini onayladi.%s%s Ardindan kaydi faturalandirip Mali Musavire gonderin.",
                        actor.displayName(), saved.getTitle(), fmt(saved.getAmount()),
                        unpaid ? String.format(" Kalan borc: %s TL (vade: %s).", fmt(saved.getRemainingAmount()), saved.getDueDate()) : "",
                        docMissing ? " Fatura/fis numarasi ve karsi taraf bilgisi tamamlanmali." : ""),
                actor.displayName(), unpaid ? "EXPENSE_PAYMENT" : "EXPENSE_APPROVED", id, "/accounting", "INFO");
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(saved);
    }

    /**
     * Muhasebe: onaylanan gideri faturalandirir (belge no ve karsi taraf bu adimda tamamlanabilir; tutar degismez)
     * ve Mali Musavir incelemesine gonderir. Tahakkuk esasi geregi vadeli (odenmemis) fatura da gonderilebilir;
     * odeme durumu Mali Musavire bildirilir.
     */
    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse submitToAdvisor(Long id, String invoiceNumber, String counterparty, String note) {
        AuthenticatedUser actor = requirePermission(Permissions.P.EXPENSE_SUBMIT, "Belgeyi Mali Musavire yalnizca Muhasebe gonderebilir");
        Expense e = lock(id);
        if (e.isFinalized()) {
            throw new BusinessRuleException("Bu gider zaten resmi deftere islenmis.");
        }
        if (!Expense.STATUS_APPROVED.equals(e.getStatus())) {
            throw new BusinessRuleException("Mali Musavire yalnizca onaylanmis giderler gonderilebilir. Mevcut durum: " + e.getStatus());
        }
        if (Boolean.TRUE.equals(e.getSentToAdvisor())) {
            throw new BusinessRuleException("Bu gider zaten Mali Musavir incelemesinde.");
        }
        periodService.assertOpen(e.getPeriod());
        String inv = blankToNull(invoiceNumber);
        String cp = blankToNull(counterparty);
        if ((inv != null && inv.length() > 100) || (cp != null && cp.length() > 200)) {
            throw new IllegalArgumentException("Belge numarasi en fazla 100, karsi taraf en fazla 200 karakter olabilir");
        }
        String cleanNote = blankToNull(note);
        if (cleanNote != null && cleanNote.length() > 500) {
            throw new IllegalArgumentException("Gonderim notu en fazla 500 karakter olabilir");
        }
        if (inv != null) e.setInvoiceNumber(inv);
        if (cp != null) e.setCounterparty(cp);
        if (e.getInvoiceNumber() == null || e.getCounterparty() == null) {
            throw new BusinessRuleException("Belge duzeni (VUK): Mali Musavire gondermeden once fatura/fis numarasi ve "
                    + "karsi taraf (tedarikci) bilgisi girilmelidir.");
        }
        e.setSentToAdvisor(true);
        e.setSubmittedBy(actor.displayName());
        e.setSubmittedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(e);

        String payState = saved.getRemainingAmount().signum() <= 0 ? "tamami odendi"
                : saved.getPaidAmount().signum() > 0 ? "kismi odendi, kalan " + fmt(saved.getRemainingAmount()) + " TL"
                : "odenmedi (vadeli borc, vade " + saved.getDueDate() + ")";
        auditService.log("EXPENSE_SUBMITTED", "EXPENSE", id, Expense.STATUS_APPROVED, "SENT_TO_ADVISOR",
                saved.getTitle() + " | belge " + saved.getInvoiceNumber() + " | " + payState
                        + (cleanNote != null ? " | not: " + cleanNote : ""));
        notificationService.notify(List.of(AppRoles.FINANCIAL_ADVISOR),
                "Defter Onayi Bekliyor: " + saved.getTitle(),
                String.format("%s, '%s' (%s TL, belge %s, %s) kaydini faturalandirip incelemenize gonderdi. Odeme: %s.%s",
                        actor.displayName(), saved.getTitle(), fmt(saved.getAmount()), saved.getInvoiceNumber(),
                        saved.getCounterparty(), payState, cleanNote != null ? " Not: " + cleanNote : ""),
                actor.displayName(), "EXPENSE_APPROVAL", id, "/advisor-ledger", "WARNING");
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse finalizeExpense(Long id) {
        return finalizeExpense(id, null);
    }

    /** Mali Musavir onayi: gonderilen belgeyi resmi deftere isler ve kesinlestirir */
    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse finalizeExpense(Long id, String advisorNote) {
        AuthenticatedUser actor = requirePermission(Permissions.P.LEDGER_DECIDE, "Resmi deftere isleme yalnizca Mali Musavir yetkisindedir");
        Expense e = lock(id);
        if (e.isFinalized()) {
            throw new BusinessRuleException("Bu gider zaten resmi deftere islenmis ve kesinlesmistir.");
        }
        if (!Expense.STATUS_APPROVED.equals(e.getStatus())) {
            throw new BusinessRuleException("Sadece onaylanmis (APPROVED) giderler resmi deftere kesinlestirilebilir. Mevcut durum: "
                    + e.getStatus());
        }
        if (!Boolean.TRUE.equals(e.getSentToAdvisor())) {
            throw new BusinessRuleException("Bu gider henuz Muhasebe tarafindan faturalandirilip Mali Musavire gonderilmedi.");
        }
        if (e.getInvoiceNumber() == null || e.getCounterparty() == null) {
            throw new BusinessRuleException("Belge duzeni (VUK): Fatura/fis numarasi ve karsi taraf bilgisi olmayan gider "
                    + "resmi deftere islenemez. Kaydi gerekce belirterek reddedin.");
        }
        if (enforceSegregation && (actor.username().equalsIgnoreCase(e.getCreatedBy())
                || actor.displayName().equalsIgnoreCase(e.getApprovedBy()))) {
            throw new BusinessRuleException("Gorevler ayriligi ilkesi: Kaydettiginiz veya onayladiginiz gideri resmi deftere isleyemezsiniz.");
        }
        String note = blankToNull(advisorNote);
        if (note != null && note.length() > 500) {
            throw new IllegalArgumentException("Onay notu en fazla 500 karakter olabilir");
        }
        periodService.assertOpen(e.getPeriod());

        e.setStatus(Expense.STATUS_FINALIZED);
        e.setRecordedInLedger(true);
        e.setSentToAdvisor(true);
        e.setRejectionReason(null);
        e.setAdvisorNote(note);
        e.setFinalizedBy(actor.displayName());
        e.setFinalizedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(e);

        auditService.log("EXPENSE_FINALIZED", "EXPENSE", id, Expense.STATUS_APPROVED, Expense.STATUS_FINALIZED,
                saved.getTitle() + " | belge " + saved.getInvoiceNumber()
                        + (note != null ? " | not: " + note : ""));
        notificationService.notify(List.of(AppRoles.ACCOUNTANT, AppRoles.MANAGER),
                "Deftere Islendi: " + saved.getTitle(),
                String.format("%s, '%s' (%s TL) kaydini onaylayip resmi deftere isledi.%s",
                        actor.displayName(), saved.getTitle(), fmt(saved.getAmount()), note != null ? " Not: " + note : ""),
                actor.displayName(), "EXPENSE_FINALIZED", id, "/accounting", "INFO");
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse rejectExpense(Long id, String reason) {
        AuthenticatedUser actor = currentUserService.require();
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.length() < 10) {
            throw new IllegalArgumentException("Ret gerekcesi zorunludur (en az 10 karakter): orn. 'Fatura asli eksik', 'Vergi no hatali'");
        }
        Expense e = lock(id);
        if (e.isFinalized()) {
            throw new BusinessRuleException("Resmi deftere kesinlestirilmis gider (FINALIZED) dogrudan reddedilemez.");
        }
        if (Expense.STATUS_REJECTED.equals(e.getStatus())) {
            throw new BusinessRuleException("Bu gider zaten reddedilmis; duzeltme bekleniyor.");
        }
        boolean underReview = Expense.STATUS_APPROVED.equals(e.getStatus()) && Boolean.TRUE.equals(e.getSentToAdvisor());
        boolean isAdvisor = currentUserService.can(Permissions.P.LEDGER_DECIDE);
        if (underReview && !isAdvisor) {
            throw new AccessDeniedException("Mali Musavir incelemesindeki kaydi yalnizca Mali Musavir reddedebilir");
        }
        if (!underReview && !currentUserService.can(Permissions.P.EXPENSE_APPROVE)) {
            if (isAdvisor) {
                throw new BusinessRuleException("Bu kayit henuz Muhasebe tarafindan incelemenize gonderilmedi.");
            }
            throw new AccessDeniedException("Onay asamasindaki gideri yalnizca Isletme Muduru reddedebilir");
        }
        periodService.assertOpen(e.getPeriod());
        String old = e.getStatus();
        e.setStatus(Expense.STATUS_REJECTED);
        e.setRecordedInLedger(false);
        e.setSentToAdvisor(false);
        e.setSubmittedBy(null);
        e.setSubmittedAt(null);
        e.setRejectionReason(cleanReason);
        e.setRejectedBy(actor.displayName());
        e.setRejectedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(e);

        auditService.log("EXPENSE_REJECTED", "EXPENSE", id, old, Expense.STATUS_REJECTED,
                (underReview ? "Mali Musavir reddi: " : "Mudur reddi: ") + cleanReason);
        notificationService.notify(List.of(AppRoles.ACCOUNTANT, AppRoles.MANAGER),
                (underReview ? "Mali Musavir Reddetti: " : "Mudur Reddetti: ") + saved.getTitle(),
                String.format("%s, '%s' (%s TL) kaydini reddetti. Gerekce: %s. Kaydi duzeltip tekrar onaya sunun.", actor.displayName(),
                        saved.getTitle(), fmt(saved.getAmount()), cleanReason),
                actor.displayName(), "EXPENSE_REJECTED", id, "/accounting", "WARNING");
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(saved);
    }

    /** Fiili odeme (kasa / banka). Kismi odeme desteklenir; toplam borcu asamaz. */
    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse payExpense(Long id, BigDecimal amount, String method, String note) {
        AuthenticatedUser actor = requirePermission(Permissions.P.EXPENSE_PAY, "Odeme kaydi yalnizca Muhasebe tarafindan girilebilir");
        Expense e = lock(id);
        if (!Expense.STATUS_APPROVED.equals(e.getStatus()) && !e.isFinalized()) {
            throw new BusinessRuleException("Yalnizca onaylanmis giderler odenebilir. Mevcut durum: " + e.getStatus());
        }
        BigDecimal remaining = e.getRemainingAmount();
        if (remaining.signum() <= 0) {
            throw new BusinessRuleException("Bu giderin odenecek bakiyesi yok.");
        }
        BigDecimal pay = amount == null ? remaining : amount.setScale(2, RoundingMode.HALF_UP);
        if (pay.signum() <= 0) {
            throw new IllegalArgumentException("Odeme tutari 0'dan buyuk olmalidir");
        }
        if (pay.subtract(remaining).compareTo(TOLERANCE) > 0) {
            throw new BusinessRuleException("Odeme tutari kalan borcu (" + fmt(remaining) + " TL) asamaz");
        }
        String m = normalizeMethod(method);
        recordPayment(e, pay, m, note);
        Expense saved = expenseRepository.save(e);

        auditService.log("EXPENSE_PAID", "EXPENSE", id, null, saved.getPaymentStatus(),
                String.format("%s TL odendi (%s). Kalan: %s TL", fmt(pay), m, fmt(saved.getRemainingAmount())));
        if (ExpenseCatalog.isInventoryPurchase(saved.getSubType())) {
            notificationService.notify(List.of(AppRoles.WAREHOUSE),
                    "Tedarik Odendi - Mal Kabul Bekleniyor",
                    String.format("'%s' icin %s TL odendi. Urun geldiginde depo terminalinden mal kabul yapin.",
                            saved.getTitle(), fmt(pay)),
                    actor.displayName(), "PROCUREMENT_PAID", id, "/warehouse", "INFO");
        }
        publishFinance("EXPENSE", id);
        return expenseMapper.toDto(saved);
    }

    private void recordPayment(Expense e, BigDecimal amount, String method, String note) {
        paymentRepository.save(new ExpensePayment(e.getId(), amount, method, currentUserService.displayName(), blankToNull(note)));
        e.setPaidAmount(e.getPaidAmount().add(amount));
        e.setLastPaymentMethod(method);
        e.refreshPaymentStatus();
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteExpense(Long id) {
        requirePermission(Permissions.P.EXPENSE_DELETE, "Taslak gideri yalnizca Muhasebe silebilir");
        Expense e = lock(id);
        if (e.isFinalized()) {
            throw new BusinessRuleException("Resmi deftere islenmis ve kesinlesmis bir gider kaydi (FINALIZED) silinemez!");
        }
        if (Expense.STATUS_APPROVED.equals(e.getStatus())) {
            throw new BusinessRuleException("Onaylanmis gider silinemez; once gerekceli olarak reddedilmelidir.");
        }
        if (e.getPaidAmount().signum() > 0) {
            throw new BusinessRuleException("Odemesi yapilmis gider silinemez; odeme kaydi denetim izinin parcasidir.");
        }
        periodService.assertOpen(e.getPeriod());
        e.markDeleted(currentUserService.username());
        expenseRepository.save(e);
        expenseRepository.delete(e);
        auditService.log("EXPENSE_DELETED", "EXPENSE", id, e.getStatus(), "DELETED", e.getTitle());
        publishFinance("EXPENSE", id);
    }

    // ── Tedarik talebi ─────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse createPurchaseRequest(Long itemId, BigDecimal quantity, boolean urgent, String note) {
        AuthenticatedUser actor = requirePermission(Permissions.P.PURCHASE_REQUEST, "Tedarik talebini Mutfak Sefi veya Depo Sorumlusu acar");
        if (quantity == null || quantity.signum() <= 0) {
            throw new IllegalArgumentException("Talep miktari 0'dan buyuk olmalidir");
        }
        InventoryItem item = inventoryItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Stok kalemi bulunamadi"));
        BigDecimal unitCost = item.getUnitCost() == null ? BigDecimal.ZERO : item.getUnitCost();
        if (unitCost.signum() <= 0) {
            throw new BusinessRuleException("Bu kalemin birim maliyeti tanimli degil; tahmini tutar hesaplanamiyor.");
        }
        BigDecimal estimate = quantity.multiply(unitCost).setScale(2, RoundingMode.HALF_UP);
        String qtyText = quantity.stripTrailingZeros().toPlainString() + " " + item.getUnit();

        ExpenseCreateRequest req = new ExpenseCreateRequest();
        req.setTitle(item.getName() + " alim talebi (" + qtyText + ")");
        req.setCategory("VARIABLE");
        req.setSubType("RAW_MATERIAL");
        req.setAmount(estimate);
        req.setExpenseDate(LocalDate.now());
        req.setDueDate(LocalDate.now().plusDays(urgent ? 1 : 3));
        req.setCounterparty(item.getSupplier() != null && !item.getSupplier().equals("-") ? item.getSupplier() : null);
        req.setNote((urgent ? "[ACIL] " : "") + "Tahmini tutar (birim maliyet x miktar). Mevcut stok: "
                + item.getCurrentStock().stripTrailingZeros().toPlainString() + " " + item.getUnit()
                + (note != null && !note.isBlank() ? ". Not: " + note.trim() : "")
                + ". Fatura geldiginde tutar ve belge no guncellenmelidir.");
        req.setInventoryItemId(item.getId());
        req.setPurchaseQuantity(quantity);

        Expense entity = new Expense();
        applyEditable(entity, req);
        periodService.assertOpen(entity.getPeriod());
        entity.setRecordedBy(actor.displayName());
        entity.setStatus(Expense.STATUS_PENDING);
        entity.setInventoryItemId(item.getId());
        entity.setPurchaseQuantity(quantity);
        entity.setPaidAmount(BigDecimal.ZERO);
        entity.refreshPaymentStatus();
        Expense saved = expenseRepository.save(entity);

        auditService.log("PURCHASE_REQUESTED", "EXPENSE", saved.getId(), null, Expense.STATUS_PENDING,
                item.getName() + " " + qtyText + " | tahmini " + fmt(estimate) + " TL");
        notificationService.notify(List.of(AppRoles.ACCOUNTANT, AppRoles.MANAGER, AppRoles.WAREHOUSE),
                (urgent ? "ACIL " : "") + "Tedarik Talebi: " + item.getName(),
                String.format("%s, %s icin %s tedarik talebi acti. Tahmini tutar: %s TL. Mudur onayi bekleniyor.",
                        actor.displayName(), item.getName(), qtyText, fmt(estimate)),
                actor.displayName(), "PURCHASE_REQUEST", saved.getId(), "/approvals", urgent ? "CRITICAL" : "WARNING");
        chatService.postSystemMessage("warehouse", actor.displayName(), actor.role(),
                String.format("%s%s icin %s tedarik talebi acildi (tahmini %s TL). Mudur onayindan sonra Muhasebe siparisi verecek.",
                        urgent ? "[ACIL] " : "", item.getName(), qtyText, fmt(estimate)));
        publishFinance("EXPENSE", saved.getId());
        return expenseMapper.toDto(saved);
    }

    // ── Sayfali arama ──────────────────────────────────────────

    public static final List<String> TABS = List.of("pending", "payable", "submit", "rejected", "ledger", "finalized", "all");

    private static Specification<Expense> tabSpec(String tab, String period) {
        Specification<Expense> byPeriod = (root, q, cb) -> period == null ? cb.conjunction() : cb.equal(root.get("period"), period);
        return switch (tab) {
            case "pending" -> byPeriod.and((root, q, cb) -> cb.equal(root.get("status"), Expense.STATUS_PENDING));
            case "rejected" -> byPeriod.and((root, q, cb) -> cb.equal(root.get("status"), Expense.STATUS_REJECTED));
            // Muhasebe: onaylanmis, henuz Mali Musavire gonderilmemis (odeme / faturalandirma bekleyen)
            case "submit" -> byPeriod.and((root, q, cb) -> cb.and(cb.equal(root.get("status"), Expense.STATUS_APPROVED),
                    cb.or(cb.isNull(root.get("sentToAdvisor")), cb.isFalse(root.get("sentToAdvisor")))));
            // Mali Musavir: gonderilmis ve inceleme bekleyen
            case "ledger" -> byPeriod.and((root, q, cb) -> cb.and(cb.equal(root.get("status"), Expense.STATUS_APPROVED),
                    cb.isTrue(root.get("sentToAdvisor"))));
            case "finalized" -> byPeriod.and((root, q, cb) -> cb.equal(root.get("status"), Expense.STATUS_FINALIZED));
            // Odenmemis borclar donemden bagimsizdir
            case "payable" -> (root, q, cb) -> cb.and(
                    root.get("status").in(Expense.STATUS_APPROVED, Expense.STATUS_FINALIZED),
                    cb.lessThan(cb.coalesce(root.get("paidAmount"), BigDecimal.ZERO), root.get("amount")));
            default -> byPeriod;
        };
    }

    private static Specification<Expense> textSpec(String text) {
        if (text == null || text.isBlank()) return (root, q, cb) -> cb.conjunction();
        String like = "%" + text.trim().toLowerCase(Locale.ROOT) + "%";
        return (root, q, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), like),
                cb.like(cb.lower(cb.coalesce(root.get("counterparty"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("invoiceNumber"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("note"), "")), like),
                cb.like(cb.lower(root.get("subType")), like));
    }

    /**
     * Muhasebe ekrani icin sayfali liste. meta.counts: sekme rozetleri (arama filtresinden bagimsiz).
     */
    public PageResponse<ExpenseResponse> search(String rawPeriod, String rawTab, String text, Integer page, Integer size) {
        return search(rawPeriod, rawTab, text, page, size, null);
    }

    private static final Map<String, String> SORTABLE = Map.of(
            "expenseDate", "expenseDate", "dueDate", "dueDate", "amount", "amount", "title", "title",
            "status", "status", "counterparty", "counterparty", "remainingAmount", "amount", "createdAt", "createdAt");

    public PageResponse<ExpenseResponse> search(String rawPeriod, String rawTab, String text, Integer page, Integer size,
                                                String rawSort) {
        String period = rawPeriod == null || rawPeriod.isBlank() ? null : AccountingPeriodService.validatePeriod(rawPeriod);
        String tab = rawTab == null || !TABS.contains(rawTab) ? "all" : rawTab;
        Sort sort = PageResponse.sort(rawSort, SORTABLE, "payable".equals(tab)
                ? Sort.by(Sort.Order.asc("dueDate"), Sort.Order.asc("id"))
                : Sort.by(Sort.Order.desc("expenseDate"), Sort.Order.desc("id")));
        Page<Expense> result = expenseRepository.findAll(tabSpec(tab, period).and(textSpec(text)),
                PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size), sort));

        Map<String, Object> counts = new LinkedHashMap<>();
        for (String t : TABS) counts.put(t, expenseRepository.count(tabSpec(t, period)));
        BigDecimal pageTotal = result.getContent().stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("counts", counts);
        meta.put("tab", tab);
        meta.put("pageTotal", pageTotal);
        return PageResponse.of(result, expenseMapper::toDto, meta);
    }

    // ── Ozet ───────────────────────────────────────────────────

    public Map<String, Object> getExpenseSummary() {
        List<Expense> all = expenseRepository.findAll();
        BigDecimal totalFixed = BigDecimal.ZERO;
        BigDecimal totalVariable = BigDecimal.ZERO;
        BigDecimal unpaid = BigDecimal.ZERO;
        Map<String, BigDecimal> fixedBreakdown = new HashMap<>();
        Map<String, BigDecimal> variableBreakdown = new HashMap<>();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Expense e : all) {
            byStatus.merge(e.getStatus(), 1L, Long::sum);
            if (Expense.STATUS_REJECTED.equals(e.getStatus())) continue;
            BigDecimal amt = e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO;
            if ("FIXED".equalsIgnoreCase(e.getCategory())) {
                totalFixed = totalFixed.add(amt);
                fixedBreakdown.merge(e.getSubType(), amt, BigDecimal::add);
            } else {
                totalVariable = totalVariable.add(amt);
                variableBreakdown.merge(e.getSubType(), amt, BigDecimal::add);
            }
            if (Expense.STATUS_APPROVED.equals(e.getStatus()) || e.isFinalized()) {
                unpaid = unpaid.add(e.getRemainingAmount());
            }
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalFixed", totalFixed);
        summary.put("totalVariable", totalVariable);
        summary.put("grandTotal", totalFixed.add(totalVariable));
        summary.put("fixedBreakdown", fixedBreakdown);
        summary.put("variableBreakdown", variableBreakdown);
        summary.put("totalExpenseCount", all.size());
        summary.put("countByStatus", byStatus);
        summary.put("unpaidApprovedTotal", unpaid);
        return summary;
    }

    // ── Yardimcilar ────────────────────────────────────────────

    public static String normalizeMethod(String method) {
        if (method == null || method.isBlank()) return ExpensePayment.CASH;
        String m = method.trim().toUpperCase(Locale.forLanguageTag("tr")).replace('İ', 'I');
        if (m.contains("NAKIT") || m.equals("CASH")) return ExpensePayment.CASH;
        if (m.contains("HAVALE") || m.contains("EFT") || m.contains("BANKA") || m.equals("BANK_TRANSFER") || m.equals("BANK")) {
            return ExpensePayment.BANK_TRANSFER;
        }
        if (m.contains("KART") || m.contains("CARD")) return ExpensePayment.CREDIT_CARD;
        throw new IllegalArgumentException("Gecersiz odeme yontemi: " + method + " (CASH, BANK_TRANSFER, CREDIT_CARD)");
    }

    private void publishFinance(String type, Long id) {
        notificationService.publish("/topic/finance", Map.of("type", type, "id", id));
    }

    static String fmt(BigDecimal v) {
        if (v == null) return "0,00";
        return String.format(Locale.forLanguageTag("tr-TR"), "%,.2f", v);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
