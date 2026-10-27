package com.gastrosync.service;

import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.mapper.ExpenseMapper;
import com.gastrosync.model.Expense;
import com.gastrosync.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Service Layer for Expense management and financial accounting transactions.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN & DEFENSE NOTES (Thesis Defense)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. STRICT LAYER DECOUPLING & MAPPER INTEGRATION:
 *    Uses MapStruct (ExpenseMapper) to ensure entities NEVER leak outside the service
 *    boundary. Controllers and HTTP clients only see ExpenseResponse and ExpenseCreateRequest.
 *
 * 2. TRANSACTION MANAGEMENT (@Transactional):
 *    - readOnly = true on queries skips Hibernate dirty checking, optimizes connection
 *      pool throughput, and allows reading from replica databases in scaled architectures.
 *    - rollbackFor = Exception.class on writes guarantees atomic database writes.
 *
 * 3. TRANSPARENT SOFT DELETE:
 *    When deleteExpense(id) is called, expenseRepository.deleteById(id) executes
 *    Hibernate's @SQLDelete query, setting `is_deleted = true` without physical row deletion.
 */
@Service
@Transactional(readOnly = true)
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseMapper expenseMapper;

    public ExpenseService(ExpenseRepository expenseRepository, ExpenseMapper expenseMapper) {
        this.expenseRepository = expenseRepository;
        this.expenseMapper = expenseMapper;
        initDefaultExpensesIfEmpty();
    }

    private void initDefaultExpensesIfEmpty() {
        if (expenseRepository.count() == 0) {
            String currentPeriod = LocalDate.now().getYear() + "-" + String.format("%02d", LocalDate.now().getMonthValue());
            LocalDate today = LocalDate.now();

            // 1. Sabit Giderler
            expenseRepository.save(new Expense("Merkez Restoran Kirası", "FIXED", "RENT", new BigDecimal("45000.00"), currentPeriod, today, "Sistem / Muhasebe", "Ana cadde şube aylık kira bedeli"));
            expenseRepository.save(new Expense("Mutfak & Servis Personel Maaşları", "FIXED", "LABOR", new BigDecimal("85000.00"), currentPeriod, today, "Sistem / Muhasebe", "1 Şef, 2 Aşçı, 3 Garson net maaş bordrosu"));
            expenseRepository.save(new Expense("Mali Müşavirlik & Danışmanlık Ücreti", "FIXED", "ACCOUNTANT", new BigDecimal("8500.00"), currentPeriod, today, "Sistem / Muhasebe", "Aylık defter tutma ve vergi beyan danışmanlığı"));

            // 2. Değişken Giderler
            expenseRepository.save(new Expense("Sanayi Tipi Mutfak Elektrik Faturası", "VARIABLE", "ELECTRICITY", new BigDecimal("14200.00"), currentPeriod, today, "Sistem / Muhasebe", "Soğuk hava depoları ve pişirme fırınları", false, true, true));
            expenseRepository.save(new Expense("Şebeke Su Faturası & Arıtma", "VARIABLE", "WATER", new BigDecimal("3800.00"), currentPeriod, today, "Sistem / Muhasebe", "Bulaşıkhane ve genel su tüketimi", false, true, true));
            expenseRepository.save(new Expense("Endüstriyel Ocak Doğalgaz Tüketimi", "VARIABLE", "GAS", new BigDecimal("9600.00"), currentPeriod, today, "Sistem / Muhasebe", "Kuzine ve fırın hattı", false, true, true));
            expenseRepository.save(new Expense("Ambalaj & Sarf Malzemeleri", "VARIABLE", "CONSUMABLES", new BigDecimal("6400.00"), currentPeriod, today, "Sistem / Muhasebe", "Paket servis kutuları ve hijyen ürünleri", false, true, true));
        }
    }

    public List<ExpenseResponse> getAllExpenses() {
        List<Expense> expenses = expenseRepository.findAllByOrderByExpenseDateDescIdDesc();
        return expenseMapper.toDtoList(expenses);
    }

    public List<ExpenseResponse> getExpensesByCategory(String category) {
        List<Expense> expenses = expenseRepository.findByCategory(category.toUpperCase());
        return expenseMapper.toDtoList(expenses);
    }

    public ExpenseResponse getExpenseById(Long id) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gider kaydı bulunamadı: ID " + id));
        return expenseMapper.toDto(expense);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse createExpense(ExpenseCreateRequest request) {
        Expense entity = expenseMapper.toEntity(request);

        if (entity.getExpenseDate() == null) {
            entity.setExpenseDate(LocalDate.now());
        }
        if (entity.getPeriod() == null || entity.getPeriod().isBlank()) {
            entity.setPeriod(entity.getExpenseDate().getYear() + "-" + String.format("%02d", entity.getExpenseDate().getMonthValue()));
        }

        Expense saved = expenseRepository.save(entity);
        return expenseMapper.toDto(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse updateExpense(Long id, ExpenseCreateRequest request) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Güncellenecek gider bulunamadı: ID " + id));

        // State Machine Guard: Finalized records cannot be modified
        if ("FINALIZED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Resmi deftere işlenmiş ve kesinleşmiş bir gider kaydı (FINALIZED) güncellenemez!");
        }

        expenseMapper.updateEntityFromDto(request, existing);
        Expense updated = expenseRepository.save(existing);
        return expenseMapper.toDto(updated);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteExpense(Long id) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Silinecek gider bulunamadı: ID " + id));

        // State Machine Guard: Finalized official ledger records cannot be deleted
        if ("FINALIZED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Resmi deftere işlenmiş ve kesinleşmiş bir gider kaydı (FINALIZED) silinemez!");
        }

        // Triggers Hibernate @SQLDelete for soft deletion
        expenseRepository.delete(existing);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse approveExpense(Long id) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Onaylanacak gider bulunamadı: ID " + id));

        // State Machine Guard: Finalized records cannot be modified/approved again
        if ("FINALIZED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Resmi deftere işlenmiş ve kesinleşmiş gider (FINALIZED) yeniden onaylanamaz.");
        }

        existing.setStatus("APPROVED");
        existing.setPaidByCashier(true);
        existing.setPaymentStatus("PAID");
        existing.setSentToAdvisor(true);
        existing.setRejectionReason(null);
        Expense updated = expenseRepository.save(existing);
        return expenseMapper.toDto(updated);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse finalizeExpense(Long id) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deftere işlenecek gider bulunamadı: ID " + id));

        // State Machine Guard: Only APPROVED expenses can transition to FINALIZED
        if ("FINALIZED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Bu gider zaten resmi deftere işlenmiş ve kesinleşmiştir.");
        }
        if (!"APPROVED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Sadece onaylanmış (APPROVED) giderler Mali Müşavir tarafından resmi deftere kesinleştirilebilir. Mevcut durum: " + existing.getStatus());
        }

        existing.setStatus("FINALIZED");
        existing.setRecordedInLedger(true);
        existing.setSentToAdvisor(true);
        existing.setRejectionReason(null);
        Expense updated = expenseRepository.save(existing);
        return expenseMapper.toDto(updated);
    }

    @Transactional(rollbackFor = Exception.class)
    public ExpenseResponse rejectExpense(Long id, String reason) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reddedilecek gider bulunamadı: ID " + id));

        // State Machine Guard: Once officially recorded in the fiscal ledger, it cannot be rejected without formal cancellation
        if ("FINALIZED".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Resmi deftere kesinleştirilmiş gider (FINALIZED) doğrudan reddedilemez.");
        }

        existing.setStatus("REJECTED");
        existing.setRecordedInLedger(false);
        existing.setRejectionReason(reason != null && !reason.isBlank() ? reason : "Mali Müşavir / Yönetim tarafından reddedildi.");
        Expense updated = expenseRepository.save(existing);
        return expenseMapper.toDto(updated);
    }

    public Map<String, Object> getExpenseSummary() {
        List<Expense> all = expenseRepository.findAll();
        BigDecimal totalFixed = BigDecimal.ZERO;
        BigDecimal totalVariable = BigDecimal.ZERO;

        Map<String, BigDecimal> fixedBreakdown = new HashMap<>();
        Map<String, BigDecimal> variableBreakdown = new HashMap<>();

        for (Expense e : all) {
            BigDecimal amt = e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO;
            if ("FIXED".equalsIgnoreCase(e.getCategory())) {
                totalFixed = totalFixed.add(amt);
                fixedBreakdown.put(e.getSubType(), fixedBreakdown.getOrDefault(e.getSubType(), BigDecimal.ZERO).add(amt));
            } else {
                totalVariable = totalVariable.add(amt);
                variableBreakdown.put(e.getSubType(), variableBreakdown.getOrDefault(e.getSubType(), BigDecimal.ZERO).add(amt));
            }
        }

        BigDecimal grandTotal = totalFixed.add(totalVariable);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalFixed", totalFixed);
        summary.put("totalVariable", totalVariable);
        summary.put("grandTotal", grandTotal);
        summary.put("fixedBreakdown", fixedBreakdown);
        summary.put("variableBreakdown", variableBreakdown);
        summary.put("totalExpenseCount", all.size());
        return summary;
    }
}
