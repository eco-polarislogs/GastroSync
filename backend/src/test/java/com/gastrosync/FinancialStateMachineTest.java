package com.gastrosync;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.model.Expense;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.service.ExpenseService;

/**
 * Isolated Domain Test: 3-Tier Financial Ledger State Machine.
 *
 * Verifies the strict progression PENDING -> APPROVED -> FINALIZED,
 * tamper-resistance protection on finalized legal ledgers, and rejection flows.
 */
@SpringBootTest
public class FinancialStateMachineTest {

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Test
    @DisplayName("FSM 1: Giderin PENDING_APPROVAL -> APPROVED -> FINALIZED 3 Kademeli İlerleme Döngüsü")
    @Transactional
    public void testStrictThreeTierFlow() {
        // 1. Aşama: Gider Faturası Oluşturma (Beklemede - PENDING_APPROVAL)
        ExpenseCreateRequest request = new ExpenseCreateRequest();
        request.setTitle("Mutfak Endüstriyel Gaz Dolumu " + System.currentTimeMillis());
        request.setCategory("VARIABLE");
        request.setSubType("ENERGY");
        request.setAmount(new BigDecimal("8500.00"));
        request.setPeriod(LocalDate.now().toString().substring(0, 7));
        request.setExpenseDate(LocalDate.now());
        request.setDueDate(LocalDate.now().plusDays(15));
        request.setCounterparty("Aygaz Endüstriyel Enerji");
        request.setInvoiceNumber("AYG-" + System.currentTimeMillis());

        ExpenseResponse created = expenseService.createExpense(request);
        assertNotNull(created.getId());
        assertEquals("PENDING_APPROVAL", created.getStatus());
        assertFalse(Boolean.TRUE.equals(created.getPaidByCashier()));
        assertFalse(Boolean.TRUE.equals(created.getRecordedInLedger()));

        // 2. Aşama: Kasa / İşletme Müdürü Onayı ve Ödeme (APPROVED)
        ExpenseResponse approved = expenseService.approveExpense(created.getId());
        assertEquals("APPROVED", approved.getStatus());
        assertTrue(Boolean.TRUE.equals(approved.getPaidByCashier()));
        assertEquals("PAID", approved.getPaymentStatus());
        assertFalse(Boolean.TRUE.equals(approved.getRecordedInLedger()));

        // 3. Aşama: Mali Müşavir (SMMM) Resmi Yevmiye Defteri Tasdiki (FINALIZED)
        ExpenseResponse finalized = expenseService.finalizeExpense(approved.getId());
        assertEquals("FINALIZED", finalized.getStatus());
        assertTrue(Boolean.TRUE.equals(finalized.getRecordedInLedger()));
    }

    @Test
    @DisplayName("FSM 2: Resmi Deftere İşlenmiş (FINALIZED) Faturanın Silinememesi (Tahrifat Direnci)")
    @Transactional
    public void testFinalizedExpenseCannotBeDeleted() {
        Expense expense = new Expense();
        expense.setTitle("Kira Resmi Fatura " + System.currentTimeMillis());
        expense.setCategory("FIXED");
        expense.setSubType("RENT");
        expense.setAmount(new BigDecimal("45000.00"));
        expense.setPeriod(LocalDate.now().toString().substring(0, 7));
        expense.setExpenseDate(LocalDate.now());
        expense.setDueDate(LocalDate.now().plusDays(5));
        expense.setCounterparty("Mülk Sahibi Ltd.");
        expense.setInvoiceNumber("KIR-" + System.currentTimeMillis());
        expense.setStatus("FINALIZED");
        expense.setPaidByCashier(true);
        expense.setRecordedInLedger(true);
        expense.setPaymentStatus("PAID");
        expense = expenseRepository.save(expense);

        Long expenseId = expense.getId();

        // Silme teşebbüsü IllegalStateException fırlatmalıdır
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            expenseService.deleteExpense(expenseId);
        });

        assertTrue(ex.getMessage().contains("resmi deftere işlenmiş") || ex.getMessage().contains("silinemez") || ex.getMessage().contains("FINALIZED"));

        // Veritabanında faturanın hala durduğu doğrulanır
        assertTrue(expenseRepository.existsById(expenseId));
    }

    @Test
    @DisplayName("FSM 3: Mali Müşavir Tarafından Gerekçeli Ret (REJECTED) ve Kasa Bildirimi")
    @Transactional
    public void testRejectionFlowWithReason() {
        Expense expense = new Expense();
        expense.setTitle("Şüpheli Reklam Faturası " + System.currentTimeMillis());
        expense.setCategory("VARIABLE");
        expense.setSubType("MARKETING");
        expense.setAmount(new BigDecimal("12000.00"));
        expense.setPeriod(LocalDate.now().toString().substring(0, 7));
        expense.setExpenseDate(LocalDate.now());
        expense.setDueDate(LocalDate.now().plusDays(10));
        expense.setCounterparty("Tanıtım Ajansı");
        expense.setInvoiceNumber("REK-" + System.currentTimeMillis());
        expense.setStatus("APPROVED");
        expense.setPaidByCashier(true);
        expense.setRecordedInLedger(false);
        expense = expenseRepository.save(expense);

        // Müşavir Tevkifat eksikliği gerekçesiyle reddeder
        ExpenseResponse rejected = expenseService.rejectExpense(expense.getId(), "Tevkifat oranı hatalı girilmiş, düzeltilip tekrar iletilmeli.");
        assertEquals("REJECTED", rejected.getStatus());
        assertFalse(Boolean.TRUE.equals(rejected.getRecordedInLedger()));
        assertEquals("Tevkifat oranı hatalı girilmiş, düzeltilip tekrar iletilmeli.", rejected.getRejectionReason());
    }
}
