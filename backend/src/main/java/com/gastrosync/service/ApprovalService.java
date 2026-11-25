package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.ApprovalRequest;
import com.gastrosync.model.CheckItem;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.model.TableCheck;
import com.gastrosync.repository.ApprovalRequestRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;
import com.gastrosync.security.Permissions.P;

/**
 * Roller arasi onay talepleri (yonetici onayi).
 *
 * Akis: talep (Kasiyer / Depo) -> bildirim + canli sinyal (Mudur) -> onay: islem sunucuda uygulanir,
 * talep acana bildirim gider | ret: gerekce zorunlu, talep acana bildirim gider | geri cekme: yalnizca talep acan.
 * Talep acan kisi kendi talebine karar veremez. Hedef kayit karar verilmeden kapanirsa talep EXPIRED olur.
 */
@Service
@Transactional
public class ApprovalService {

    /** Bir kullanicinin ayni anda acik tutabilecegi talep sayisi (kotuye kullanim / gurultu siniri) */
    static final int MAX_OPEN_PER_USER = 20;

    private static final Map<String, P> APPROVER = Map.of(
            ApprovalRequest.ITEM_VOID, P.POS_CANCEL_APPROVE,
            ApprovalRequest.CHECK_VOID, P.POS_CANCEL_APPROVE,
            ApprovalRequest.COMP, P.POS_DISCOUNT_APPROVE,
            ApprovalRequest.DISCOUNT, P.POS_DISCOUNT_APPROVE,
            ApprovalRequest.STOCK_ADJUST, P.INVENTORY_ADJUST_APPROVE);

    private static final Map<String, String> TYPE_LABELS = Map.of(
            ApprovalRequest.ITEM_VOID, "Kalem iptali",
            ApprovalRequest.CHECK_VOID, "Adisyon iptali",
            ApprovalRequest.COMP, "İkram",
            ApprovalRequest.DISCOUNT, "İndirim",
            ApprovalRequest.STOCK_ADJUST, "Sayım farkı");

    private static final Map<String, String> STATUS_LABELS = Map.of(
            ApprovalRequest.PENDING, "Onay bekliyor",
            ApprovalRequest.APPROVED, "Onaylandı",
            ApprovalRequest.REJECTED, "Reddedildi",
            ApprovalRequest.WITHDRAWN, "Geri çekildi",
            ApprovalRequest.EXPIRED, "Geçersiz (kayıt değişti)");

    private final ApprovalRequestRepository repository;
    private final PosService posService;
    private final InventoryService inventoryService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;

    public ApprovalService(ApprovalRequestRepository repository, PosService posService, InventoryService inventoryService,
                           NotificationService notificationService, AuditService auditService,
                           CurrentUserService currentUserService) {
        this.repository = repository;
        this.posService = posService;
        this.inventoryService = inventoryService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
    }

    public record RequestInput(String type, Long targetId, String reason, BigDecimal percent, BigDecimal amount,
                               BigDecimal countedQuantity) {}

    // ── Talep ──────────────────────────────────────────────────

    public Map<String, Object> request(RequestInput in) {
        AuthenticatedUser me = currentUserService.require();
        String type = in.type() == null ? "" : in.type().trim().toUpperCase(Locale.ROOT);
        if (!APPROVER.containsKey(type)) {
            throw new IllegalArgumentException("Gecersiz talep turu: " + in.type() + " (ITEM_VOID, CHECK_VOID, COMP, DISCOUNT, STOCK_ADJUST)");
        }
        if (in.targetId() == null) throw new IllegalArgumentException("Talep hedefi (targetId) zorunludur");
        if (repository.countByStatusAndRequestedBy(ApprovalRequest.PENDING, me.username()) >= MAX_OPEN_PER_USER) {
            throw new BusinessRuleException("Karar bekleyen " + MAX_OPEN_PER_USER + " talebiniz var; yeni talep icin once sonuclanmalarini bekleyin");
        }
        P approverPerm = APPROVER.get(type);
        if (currentUserService.can(approverPerm)) {
            throw new BusinessRuleException("Bu islem icin onay yetkiniz var; talep acmadan dogrudan uygulayin");
        }

        ApprovalRequest a = new ApprovalRequest();
        a.setType(type);
        a.setApproverPermission(approverPerm.name());
        a.setRequestedBy(me.username());
        a.setRequestedByName(me.displayName());
        a.setRequestedRole(me.role());

        switch (type) {
            case ApprovalRequest.ITEM_VOID, ApprovalRequest.COMP -> prepareItemRequest(a, in);
            case ApprovalRequest.CHECK_VOID, ApprovalRequest.DISCOUNT -> prepareCheckRequest(a, in);
            case ApprovalRequest.STOCK_ADJUST -> {
                return submitCount(in.targetId(), in.countedQuantity(), in.reason());
            }
            default -> throw new IllegalArgumentException("Gecersiz talep turu");
        }
        ApprovalRequest saved = repository.save(a);
        afterRequest(saved);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("approvalRequired", true);
        out.put("request", toDto(saved, me));
        return out;
    }

    /**
     * Depo sayimi: fark esigin altindaysa dogrudan islenir; asiyorsa Mudur onayina gider.
     * Donus: { approvalRequired, transaction | request, evaluation }
     */
    public Map<String, Object> submitCount(Long itemId, BigDecimal counted, String reason) {
        AuthenticatedUser me = currentUserService.require();
        if (!currentUserService.can(P.INVENTORY_COUNT) && !currentUserService.can(P.INVENTORY_ADJUST_APPROVE)) {
            throw new AccessDeniedException("Sayim duzeltmesi Depo Sorumlusu yetkisindedir");
        }
        String why = InventoryService.requireCountReason(reason);
        InventoryService.CountEvaluation ev = inventoryService.evaluateCount(itemId, counted);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("evaluation", Map.of("systemQuantity", ev.systemQuantity(), "countedQuantity", counted, "delta", ev.delta(),
                "value", ev.value(), "percent", ev.percent(), "rule", inventoryService.countApprovalRule()));
        if (!ev.requiresApproval() || currentUserService.can(P.INVENTORY_ADJUST_APPROVE)) {
            StockTransaction tx = inventoryService.adjustToCount(itemId, counted, why);
            out.put("approvalRequired", false);
            out.put("transaction", tx);
            return out;
        }
        if (repository.existsByTargetTypeAndTargetIdAndTypeAndStatus("INVENTORY_ITEM", itemId, ApprovalRequest.STOCK_ADJUST, ApprovalRequest.PENDING)) {
            throw new BusinessRuleException(ev.item().getName() + " icin karar bekleyen bir sayim talebi zaten var");
        }
        ApprovalRequest a = new ApprovalRequest();
        a.setType(ApprovalRequest.STOCK_ADJUST);
        a.setApproverPermission(P.INVENTORY_ADJUST_APPROVE.name());
        a.setRequestedBy(me.username());
        a.setRequestedByName(me.displayName());
        a.setRequestedRole(me.role());
        a.setTargetType("INVENTORY_ITEM");
        a.setTargetId(itemId);
        a.setQuantity(counted);
        a.setSystemQuantity(ev.systemQuantity());
        a.setUnit(ev.item().getUnit());
        a.setAmount(ev.value());
        a.setPercent(ev.percent().min(new BigDecimal("999.99")));
        a.setReason(why);
        a.setSummary(trim(String.format("%s | sistem %s %s, sayilan %s %s (fark %s %s, %s TL)", ev.item().getName(),
                plain(ev.systemQuantity()), ev.item().getUnit(), plain(counted), ev.item().getUnit(),
                signed(ev.delta()), ev.item().getUnit(), ExpenseService.fmt(ev.value())), 250));
        ApprovalRequest saved = repository.save(a);
        afterRequest(saved);
        out.put("approvalRequired", true);
        out.put("request", toDto(saved, me));
        return out;
    }

    private void prepareItemRequest(ApprovalRequest a, RequestInput in) {
        requirePosOperator();
        String why = requireReason(in.reason());
        CheckItem item = posService.findItem(in.targetId());
        TableCheck c = posService.lockOpenCheck(item.getCheckId());
        if (!item.isActive()) throw new BusinessRuleException("Kalem zaten iptal edilmis");
        if (ApprovalRequest.ITEM_VOID.equals(a.getType()) && CheckItem.ORDERED.equals(item.getStatus())) {
            throw new BusinessRuleException("Mutfak henuz hazirlamaya baslamadi; kalemi onay istemeden dogrudan iptal edebilirsiniz");
        }
        if (ApprovalRequest.COMP.equals(a.getType())) PosService.validateCompTarget(item);
        if (repository.existsByTargetTypeAndTargetIdAndTypeAndStatus("CHECK_ITEM", item.getId(), a.getType(), ApprovalRequest.PENDING)) {
            throw new BusinessRuleException("Bu kalem icin karar bekleyen bir talep zaten var");
        }
        a.setTargetType("CHECK_ITEM");
        a.setTargetId(item.getId());
        a.setCheckId(c.getId());
        a.setTableNumber(c.getTableNumber());
        a.setAmount(item.getListTotal());
        a.setReason(why);
        a.setSummary(trim(String.format("Masa %d | %s | %s x%d (%s TL)", c.getTableNumber(), c.getCheckNo(), item.getProductName(),
                item.getQuantity(), ExpenseService.fmt(item.getListTotal())), 250));
    }

    private void prepareCheckRequest(ApprovalRequest a, RequestInput in) {
        requirePosOperator();
        String why = requireReason(in.reason());
        TableCheck c = posService.lockOpenCheck(in.targetId());
        List<CheckItem> active = posService.activeItems(c.getId());
        if (active.isEmpty()) throw new BusinessRuleException("Adisyon bos");
        if (repository.existsByTargetTypeAndTargetIdAndTypeAndStatus("CHECK", c.getId(), a.getType(), ApprovalRequest.PENDING)) {
            throw new BusinessRuleException("Bu adisyon icin karar bekleyen bir talep zaten var");
        }
        BigDecimal subtotal = posService.payableSubtotal(c);
        a.setTargetType("CHECK");
        a.setTargetId(c.getId());
        a.setCheckId(c.getId());
        a.setTableNumber(c.getTableNumber());
        a.setReason(why);
        if (ApprovalRequest.CHECK_VOID.equals(a.getType())) {
            boolean started = active.stream().anyMatch(i -> !CheckItem.ORDERED.equals(i.getStatus()));
            if (!started) {
                throw new BusinessRuleException("Adisyondaki kalemlerin hicbiri hazirlanmaya baslamadi; onay istemeden dogrudan iptal edebilirsiniz");
            }
            a.setAmount(subtotal);
            a.setSummary(trim(String.format("Masa %d | %s | %d kalem (%s TL)", c.getTableNumber(), c.getCheckNo(),
                    active.stream().mapToInt(CheckItem::getQuantity).sum(), ExpenseService.fmt(subtotal)), 250));
        } else {
            PosService.validateDiscount(in.percent(), in.amount(), subtotal);
            boolean percent = in.percent() != null && in.percent().signum() > 0;
            BigDecimal value = percent
                    ? subtotal.multiply(in.percent()).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)
                    : in.amount().setScale(2, RoundingMode.HALF_UP);
            a.setPercent(percent ? in.percent().setScale(2, RoundingMode.HALF_UP) : null);
            a.setAmount(value);
            a.setSummary(trim(String.format("Masa %d | %s | %s indirim (adisyon %s TL, indirim %s TL)", c.getTableNumber(), c.getCheckNo(),
                    percent ? "%" + plain(in.percent()) : "Tutar", ExpenseService.fmt(subtotal), ExpenseService.fmt(value)), 250));
        }
    }

    private void afterRequest(ApprovalRequest a) {
        P approver = P.valueOf(a.getApproverPermission());
        auditService.log("APPROVAL_REQUESTED", "APPROVAL", a.getId(), null, ApprovalRequest.PENDING,
                TYPE_LABELS.get(a.getType()) + " | " + a.getSummary() + " | " + a.getReason());
        notificationService.notify(Permissions.rolesWith(approver),
                "Onay Talebi: " + TYPE_LABELS.get(a.getType()) + (a.getTableNumber() != null ? " · Masa " + a.getTableNumber() : ""),
                String.format("%s onayınızı istiyor: %s. Gerekçe: %s", a.getRequestedByName(), a.getSummary(), a.getReason()),
                a.getRequestedByName(), "APPROVAL_REQUEST", a.getId(), "/approvals", "WARNING");
        notificationService.publish("/topic/approvals", signal("REQUESTED", a));
    }

    // ── Karar ──────────────────────────────────────────────────

    public Map<String, Object> decide(Long id, boolean approve, String note) {
        AuthenticatedUser me = currentUserService.require();
        ApprovalRequest a = repository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Onay talebi bulunamadi: " + id));
        P perm = P.valueOf(a.getApproverPermission());
        if (!currentUserService.can(perm)) {
            throw new AccessDeniedException("Bu talep turune karar verme yetkiniz yok (" + Permissions.LABELS.get(perm) + ")");
        }
        if (me.username().equalsIgnoreCase(a.getRequestedBy())) {
            throw new AccessDeniedException("Kendi talebinize karar veremezsiniz (gorevler ayriligi)");
        }
        if (!a.isPending()) throw new BusinessRuleException("Talep zaten sonuclanmis: " + STATUS_LABELS.get(a.getStatus()));
        String cleanNote = note == null ? "" : note.trim();
        if (!approve && cleanNote.length() < 5) throw new IllegalArgumentException("Ret gerekcesi zorunludur (en az 5 karakter)");
        if (cleanNote.length() > 300) cleanNote = cleanNote.substring(0, 300);

        a.setDecidedBy(me.username());
        a.setDecidedByName(me.displayName());
        a.setDecidedAt(LocalDateTime.now());
        a.setDecisionNote(cleanNote.isEmpty() ? null : cleanNote);

        String expiredWhy = null;
        if (approve) {
            a.setStatus(ApprovalRequest.APPROVED);
            repository.saveAndFlush(a);
            expiredWhy = apply(a, me);
            if (expiredWhy != null) {
                a.setStatus(ApprovalRequest.EXPIRED);
                a.setDecisionNote(trim(expiredWhy, 300));
            }
        } else {
            a.setStatus(ApprovalRequest.REJECTED);
        }
        repository.save(a);

        auditService.log(approve && expiredWhy == null ? "APPROVAL_APPROVED" : expiredWhy != null ? "APPROVAL_EXPIRED" : "APPROVAL_REJECTED",
                "APPROVAL", a.getId(), ApprovalRequest.PENDING, a.getStatus(),
                TYPE_LABELS.get(a.getType()) + " | " + a.getSummary() + (a.getDecisionNote() != null ? " | " + a.getDecisionNote() : ""));
        String title = (ApprovalRequest.APPROVED.equals(a.getStatus()) ? "Talebiniz onaylandı: "
                : ApprovalRequest.REJECTED.equals(a.getStatus()) ? "Talebiniz reddedildi: " : "Talebiniz uygulanamadı: ")
                + TYPE_LABELS.get(a.getType()) + (a.getTableNumber() != null ? " · Masa " + a.getTableNumber() : "");
        String message = String.format("%s, %s talebinizi %s. %s%s", me.displayName(), a.getSummary(),
                ApprovalRequest.APPROVED.equals(a.getStatus()) ? "onayladı ve işlem uygulandı"
                        : ApprovalRequest.REJECTED.equals(a.getStatus()) ? "reddetti" : "onayladı ancak kayıt değiştiği için uygulanamadı",
                a.getDecisionNote() != null ? "Not: " + a.getDecisionNote() : "",
                ApprovalRequest.STOCK_ADJUST.equals(a.getType()) && ApprovalRequest.REJECTED.equals(a.getStatus()) ? " Ürünü yeniden sayın." : "");
        notificationService.notify(List.of(a.getRequestedRole()), title, message, me.displayName(), "APPROVAL_DECIDED", a.getId(),
                ApprovalRequest.STOCK_ADJUST.equals(a.getType()) ? "/inventory" : "/pos",
                ApprovalRequest.APPROVED.equals(a.getStatus()) ? "INFO" : "WARNING");
        Map<String, Object> sig = signal("DECIDED", a);
        notificationService.publish("/topic/approvals", sig);
        notificationService.publishToUser(a.getRequestedBy(), Map.of("type", "APPROVAL_DECIDED", "id", a.getId(), "status", a.getStatus()));
        return toDto(a, me);
    }

    /** Onaylanan islemi uygular; hedef degistiyse uygulanamama gerekcesi doner (talep EXPIRED olur) */
    private String apply(ApprovalRequest a, AuthenticatedUser approver) {
        switch (a.getType()) {
            case ApprovalRequest.ITEM_VOID, ApprovalRequest.COMP -> {
                CheckItem item = posService.findItem(a.getTargetId());
                TableCheck c = posService.findCheck(item.getCheckId());
                if (!c.isOpen()) return "Adisyon kapanmış (" + c.getStatus() + ")";
                c = posService.lockOpenCheck(c.getId());
                if (!item.isActive()) return "Kalem zaten iptal edilmiş";
                if (ApprovalRequest.ITEM_VOID.equals(a.getType())) {
                    posService.applyItemCancel(c, item, a.getReason(), a.getRequestedByName(), approver.displayName());
                } else {
                    if (item.isComp()) return "Kalem zaten ikram edilmiş";
                    posService.applyComp(c, item, a.getReason(), a.getRequestedByName(), approver.displayName());
                }
                return null;
            }
            case ApprovalRequest.CHECK_VOID, ApprovalRequest.DISCOUNT -> {
                TableCheck c = posService.findCheck(a.getTargetId());
                if (!c.isOpen()) return "Adisyon kapanmış (" + c.getStatus() + ")";
                c = posService.lockOpenCheck(c.getId());
                if (ApprovalRequest.CHECK_VOID.equals(a.getType())) {
                    posService.applyCheckCancel(c, a.getReason(), a.getRequestedByName(), approver.displayName());
                } else {
                    BigDecimal subtotal = posService.payableSubtotal(c);
                    BigDecimal amount = a.getPercent() == null ? a.getAmount() : null;
                    if (amount != null && amount.compareTo(subtotal) > 0) {
                        return "Adisyon tutarı (" + ExpenseService.fmt(subtotal) + " TL) indirim tutarının altına düştü";
                    }
                    if (subtotal.signum() <= 0) return "Adisyonda ücretli kalem kalmadı";
                    posService.applyDiscount(c, a.getPercent(), amount, a.getReason(), a.getRequestedByName(), approver.displayName());
                }
                return null;
            }
            case ApprovalRequest.STOCK_ADJUST -> {
                BigDecimal delta = a.getQuantity().subtract(a.getSystemQuantity());
                try {
                    inventoryService.applyApprovedCount(a.getTargetId(), delta, a.getReason(), a.getRequestedBy(), approver.displayName());
                } catch (BusinessRuleException e) {
                    return e.getMessage();
                }
                return null;
            }
            default -> throw new IllegalStateException("Bilinmeyen talep turu " + a.getType());
        }
    }

    public Map<String, Object> withdraw(Long id) {
        AuthenticatedUser me = currentUserService.require();
        ApprovalRequest a = repository.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Onay talebi bulunamadi: " + id));
        if (!me.username().equalsIgnoreCase(a.getRequestedBy())) {
            throw new AccessDeniedException("Yalnizca talebi acan kisi geri cekebilir");
        }
        if (!a.isPending()) throw new BusinessRuleException("Talep zaten sonuclanmis: " + STATUS_LABELS.get(a.getStatus()));
        a.setStatus(ApprovalRequest.WITHDRAWN);
        a.setDecidedAt(LocalDateTime.now());
        a.setDecisionNote("Talep acan tarafindan geri cekildi");
        repository.save(a);
        auditService.log("APPROVAL_WITHDRAWN", "APPROVAL", a.getId(), ApprovalRequest.PENDING, ApprovalRequest.WITHDRAWN,
                TYPE_LABELS.get(a.getType()) + " | " + a.getSummary());
        notificationService.publish("/topic/approvals", signal("WITHDRAWN", a));
        return toDto(a, me);
    }

    // ── Sorgular ───────────────────────────────────────────────

    /**
     * scope: inbox (karar verebildigim turler), mine (benim taleplerim), all (gecmis: karar verenler ve denetim yetkilileri)
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(String rawScope, String rawStatus, Integer page, Integer size) {
        AuthenticatedUser me = currentUserService.require();
        String scope = rawScope == null || rawScope.isBlank() ? defaultScope() : rawScope.trim().toLowerCase(Locale.ROOT);
        String status = rawStatus == null || rawStatus.isBlank() || "ALL".equalsIgnoreCase(rawStatus) ? null
                : rawStatus.trim().toUpperCase(Locale.ROOT);
        if (status != null && !STATUS_LABELS.containsKey(status)) throw new IllegalArgumentException("Gecersiz durum: " + rawStatus);
        PageRequest pr = PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size));
        Page<ApprovalRequest> result = switch (scope) {
            case "inbox" -> {
                List<String> perms = myApproverPermissions();
                if (perms.isEmpty()) throw new AccessDeniedException("Onay yetkiniz yok");
                yield repository.inbox(perms, status, pr);
            }
            case "mine" -> repository.mine(me.username(), status, pr);
            case "all" -> {
                if (myApproverPermissions().isEmpty() && !currentUserService.can(P.AUDIT_VIEW)) {
                    throw new AccessDeniedException("Tum onay gecmisini goruntuleme yetkiniz yok");
                }
                yield repository.all(status, pr);
            }
            default -> throw new IllegalArgumentException("Gecersiz kapsam: " + rawScope + " (inbox, mine, all)");
        };
        return PageResponse.of(result, a -> toDto(a, me), Map.of("scope", scope, "status", status == null ? "ALL" : status));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        AuthenticatedUser me = currentUserService.require();
        List<String> perms = myApproverPermissions();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("canDecide", !perms.isEmpty());
        m.put("pendingInbox", perms.isEmpty() ? 0 : repository.countByStatusAndApproverPermissionIn(ApprovalRequest.PENDING, perms));
        m.put("pendingMine", repository.countByStatusAndRequestedBy(ApprovalRequest.PENDING, me.username()));
        m.put("countRule", inventoryService.countApprovalRule());
        return m;
    }

    private String defaultScope() {
        return myApproverPermissions().isEmpty() ? "mine" : "inbox";
    }

    private List<String> myApproverPermissions() {
        List<String> out = new ArrayList<>();
        for (P p : Set.copyOf(APPROVER.values())) if (currentUserService.can(p)) out.add(p.name());
        return out;
    }

    private Map<String, Object> toDto(ApprovalRequest a, AuthenticatedUser me) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("type", a.getType());
        m.put("typeLabel", TYPE_LABELS.get(a.getType()));
        m.put("status", a.getStatus());
        m.put("statusLabel", STATUS_LABELS.get(a.getStatus()));
        m.put("targetType", a.getTargetType());
        m.put("targetId", a.getTargetId());
        m.put("checkId", a.getCheckId());
        m.put("tableNumber", a.getTableNumber());
        m.put("summary", a.getSummary());
        m.put("amount", a.getAmount());
        m.put("percent", a.getPercent());
        m.put("quantity", a.getQuantity());
        m.put("systemQuantity", a.getSystemQuantity());
        m.put("unit", a.getUnit());
        m.put("reason", a.getReason());
        m.put("requestedBy", a.getRequestedBy());
        m.put("requestedByName", a.getRequestedByName());
        m.put("requestedRole", a.getRequestedRole());
        m.put("requestedRoleLabel", Permissions.ROLE_LABELS.getOrDefault(AppRoles.normalize(a.getRequestedRole()), a.getRequestedRole()));
        m.put("requestedAt", a.getRequestedAt());
        m.put("decidedByName", a.getDecidedByName());
        m.put("decidedAt", a.getDecidedAt());
        m.put("decisionNote", a.getDecisionNote());
        m.put("approverLabel", Permissions.LABELS.get(P.valueOf(a.getApproverPermission())));
        boolean pending = a.isPending();
        boolean mine = me.username().equalsIgnoreCase(a.getRequestedBy());
        m.put("canDecide", pending && !mine && currentUserService.can(P.valueOf(a.getApproverPermission())));
        m.put("canWithdraw", pending && mine);
        return m;
    }

    private static Map<String, Object> signal(String event, ApprovalRequest a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", event);
        m.put("id", a.getId());
        m.put("kind", a.getType());
        m.put("status", a.getStatus());
        if (a.getCheckId() != null) m.put("checkId", a.getCheckId());
        return m;
    }

    private void requirePosOperator() {
        if (!currentUserService.can(P.POS_OPERATE)) {
            throw new AccessDeniedException("Adisyon onay talepleri Kasiyer yetkisindedir");
        }
    }

    private static String requireReason(String reason) {
        String why = reason == null ? "" : reason.trim();
        if (why.length() < 5) throw new IllegalArgumentException("Talep gerekcesi zorunludur (en az 5 karakter)");
        if (why.length() > 200) throw new IllegalArgumentException("Gerekce en fazla 200 karakter olabilir");
        return why;
    }

    private static String trim(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String plain(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }

    private static String signed(BigDecimal v) {
        return (v.signum() > 0 ? "+" : "") + plain(v);
    }
}
