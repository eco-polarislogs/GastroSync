package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.access.AccessDeniedException;

import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.AuditLog;
import com.gastrosync.model.Expense;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.service.AccountingPeriodService;
import com.gastrosync.service.AuditService;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.support.TestAuth;

/**
 * Gider durum makinesi ve meslek etigi kurallari.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
class FinancialStateMachineTest {

    @Autowired private ExpenseService expenseService;
    @Autowired private AccountingPeriodService periodService;
    @Autowired private AuditService auditService;
    @Autowired private AppUserRepository userRepository;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private ExpenseCreateRequest request(String title, String amount, String invoice) {
        ExpenseCreateRequest r = new ExpenseCreateRequest();
        r.setTitle(title);
        r.setCategory("VARIABLE");
        r.setSubType("ELECTRICITY");
        r.setAmount(new BigDecimal(amount));
        r.setExpenseDate(LocalDate.now());
        r.setInvoiceNumber(invoice);
        r.setCounterparty("Enerjisa");
        r.setVatRate(new BigDecimal("20"));
        return r;
    }

    @Test
    @DisplayName("Tam dongu: kayit -> onay (farkli kisi) -> odeme -> resmi defter; denetim izi olusur")
    void fullLifecycle() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Elektrik Faturasi FSM", "1200.00", "ELK-1"));
        assertEquals(Expense.STATUS_PENDING, created.getStatus());
        assertEquals("UNPAID", created.getPaymentStatus());
        assertEquals(new BigDecimal("200.00"), created.getVatAmount());

        TestAuth.as(userRepository, "manager");
        ExpenseResponse approved = expenseService.approveExpense(created.getId());
        assertEquals(Expense.STATUS_APPROVED, approved.getStatus());
        assertEquals("Zeynep Kaya", approved.getApprovedBy());

        TestAuth.as(userRepository, "accountant");
        ExpenseResponse partial = expenseService.payExpense(created.getId(), new BigDecimal("500"), "CASH", null);
        assertEquals("PARTIAL", partial.getPaymentStatus());
        assertEquals(new BigDecimal("700.00"), partial.getRemainingAmount());
        ExpenseResponse paid = expenseService.payExpense(created.getId(), null, "BANK_TRANSFER", null);
        assertEquals("PAID", paid.getPaymentStatus());
        assertTrue(paid.getPaidByCashier());
        assertFalse(paid.getSentToAdvisor());
        ExpenseResponse submitted = expenseService.submitToAdvisor(created.getId(), null, null, "Dekont ekte");
        assertTrue(submitted.getSentToAdvisor());
        assertEquals("Canan Ozturk", submitted.getSubmittedBy());

        TestAuth.as(userRepository, "advisor");
        ExpenseResponse finalized = expenseService.finalizeExpense(created.getId());
        assertEquals(Expense.STATUS_FINALIZED, finalized.getStatus());
        assertTrue(finalized.getRecordedInLedger());

        List<String> actions = auditService.history("EXPENSE", created.getId()).stream().map(AuditLog::getAction).toList();
        assertTrue(actions.containsAll(List.of("EXPENSE_CREATED", "EXPENSE_APPROVED", "EXPENSE_PAID", "EXPENSE_SUBMITTED", "EXPENSE_FINALIZED")));
    }

    @Test
    @DisplayName("Gorevler ayriligi: kaydeden muhasebe kendi giderini onaylayamaz; servis katmani da reddeder")
    void segregationOfDuties() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Kendi Onayi Denemesi", "300.00", "X-1"));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> expenseService.approveExpense(created.getId()));
        TestAuth.as(userRepository, "admin");
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> expenseService.approveExpense(created.getId()));
        TestAuth.as(userRepository, "manager");
        assertEquals(Expense.STATUS_APPROVED, expenseService.approveExpense(created.getId()).getStatus());
        // Odemeyi onaylayan Mudur degil, Muhasebe yapar
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> expenseService.payExpense(created.getId(), null, "CASH", null));
    }

    @Test
    @DisplayName("Yetki matrisi: hicbir rol ayni islemin birbirini denetleyen iki adimina sahip degildir")
    void permissionMatrixSegregation() {
        var P = com.gastrosync.security.Permissions.P.class;
        String[][] conflicts = {
                {"EXPENSE_CREATE", "EXPENSE_APPROVE"},   // kayit / yetkilendirme
                {"EXPENSE_APPROVE", "EXPENSE_PAY"},      // yetkilendirme / varlik muhafazasi
                {"EXPENSE_SUBMIT", "LEDGER_DECIDE"},     // muhasebe / bagimsiz denetim
                {"EXPENSE_PAY", "LEDGER_DECIDE"},
                {"CASH_CLOSING_CREATE", "CASH_CLOSING_REVIEW"}, // sayim / mutabakat
                {"POS_OPERATE", "SALES_VOID"},           // tahsilat / iptal onayi
                {"RECIPE_EDIT", "MENU_PRICE_SET"},       // recete / fiyat karari
                {"USER_MANAGE", "LEDGER_DECIDE"},
                {"USER_MANAGE", "EXPENSE_APPROVE"},
        };
        for (String role : com.gastrosync.security.Permissions.ROLE_PERMISSIONS.keySet()) {
            for (String[] c : conflicts) {
                boolean both = com.gastrosync.security.Permissions.has(role, c[0])
                        && com.gastrosync.security.Permissions.has(role, c[1]);
                assertFalse(both, role + " rolu hem " + c[0] + " hem " + c[1] + " iznine sahip olmamali");
            }
            assertFalse(com.gastrosync.security.Permissions.screensOf(role).isEmpty(), role + " icin ekran tanimli olmali");
        }
        assertTrue(P.isEnum());
    }

    @Test
    @DisplayName("Kesinlesmis kayit degistirilemez, silinemez, reddedilemez (tahrifat korumasi)")
    void finalizedIsImmutable() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Kilit Testi", "450.00", "KLT-1"));
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(created.getId());
        TestAuth.as(userRepository, "accountant");
        expenseService.submitToAdvisor(created.getId(), null, null, null);
        TestAuth.as(userRepository, "advisor");
        expenseService.finalizeExpense(created.getId());

        TestAuth.as(userRepository, "accountant");
        assertThrows(BusinessRuleException.class, () -> expenseService.updateExpense(created.getId(), request("Degisiklik", "1.00", "KLT-1")));
        assertThrows(BusinessRuleException.class, () -> expenseService.deleteExpense(created.getId()));
        TestAuth.as(userRepository, "manager");
        assertThrows(BusinessRuleException.class, () -> expenseService.rejectExpense(created.getId(), "Tahrifat denemesi yapiliyor"));
        assertThrows(BusinessRuleException.class, () -> expenseService.approveExpense(created.getId()));
        TestAuth.as(userRepository, "advisor");
        assertThrows(BusinessRuleException.class, () -> expenseService.rejectExpense(created.getId(), "Tahrifat denemesi yapiliyor"));
    }

    @Test
    @DisplayName("Belge duzeni: fatura numarasi olmayan gider deftere islenemez")
    void finalizeRequiresDocument() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Belgesiz Gider", "250.00", null));
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(created.getId());
        TestAuth.as(userRepository, "advisor");
        assertThrows(BusinessRuleException.class, () -> expenseService.finalizeExpense(created.getId()));
        TestAuth.as(userRepository, "accountant");
        BusinessRuleException ex = assertThrows(BusinessRuleException.class,
                () -> expenseService.submitToAdvisor(created.getId(), null, null, null));
        assertTrue(ex.getMessage().contains("Belge duzeni"));
    }

    @Test
    @DisplayName("Gerekceli ret zorunlu; duzeltilen kayit tekrar onaya duser")
    void rejectionRequiresReasonAndResubmission() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Ret Testi", "800.00", "RT-1"));

        // Mali Musavir yalnizca kendisine gonderilen belgeyi reddedebilir; onay asamasinda ret Mudur / Muhasebe yetkisindedir
        TestAuth.as(userRepository, "advisor");
        assertThrows(BusinessRuleException.class, () -> expenseService.rejectExpense(created.getId(), "Henuz gonderilmemis kayit"));
        TestAuth.as(userRepository, "manager");
        assertThrows(IllegalArgumentException.class, () -> expenseService.rejectExpense(created.getId(), "kisa"));
        ExpenseResponse rejected = expenseService.rejectExpense(created.getId(), "Fatura asli eksik, vergi numarasi hatali");
        assertEquals(Expense.STATUS_REJECTED, rejected.getStatus());
        assertEquals("Zeynep Kaya", rejected.getRejectedBy());

        TestAuth.as(userRepository, "accountant");
        ExpenseResponse resubmitted = expenseService.updateExpense(created.getId(), request("Ret Testi (duzeltildi)", "800.00", "RT-1-D"));
        assertEquals(Expense.STATUS_PENDING, resubmitted.getStatus());
        assertNull(resubmitted.getRejectionReason());
    }

    @Test
    @DisplayName("Odeme kurallari: onaysiz gider odenemez, fazla odeme yapilamaz")
    void paymentRules() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Odeme Kurali", "100.00", "OD-1"));
        assertThrows(BusinessRuleException.class, () -> expenseService.payExpense(created.getId(), null, "CASH", null));
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(created.getId());
        TestAuth.as(userRepository, "accountant");
        assertThrows(BusinessRuleException.class, () -> expenseService.payExpense(created.getId(), new BigDecimal("150"), "CASH", null));
        assertThrows(IllegalArgumentException.class, () -> expenseService.payExpense(created.getId(), new BigDecimal("10"), "BITCOIN", null));
    }

    @Test
    @DisplayName("Onaylanmis gider duzeltilemez; once reddedilmelidir")
    void approvedCannotBeEdited() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Onayli Duzeltme", "90.00", "OD-2"));
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(created.getId());
        TestAuth.as(userRepository, "accountant");
        assertThrows(BusinessRuleException.class, () -> expenseService.updateExpense(created.getId(), request("Yeni", "10.00", "OD-2")));
    }

    @Test
    @DisplayName("Sef sadece kendi giderini duzeltebilir")
    void ownershipOnUpdate() {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request("Sahiplik Testi", "75.00", "SH-1"));
        TestAuth.as(userRepository, "chef");
        assertThrows(AccessDeniedException.class, () -> expenseService.updateExpense(created.getId(), request("Sef Duzeltmesi", "75.00", "SH-1")));
    }

    @Test
    @DisplayName("Donem kilidi: kapatilan doneme kayit girilemez; gerekceli yeniden acilir")
    void periodLock() {
        TestAuth.as(userRepository, "advisor");
        periodService.close("2020-01", "Yil sonu kapanisi");
        assertTrue(periodService.isClosed("2020-01"));

        TestAuth.as(userRepository, "accountant");
        ExpenseCreateRequest old = request("Eski Donem", "50.00", "ESK-1");
        old.setExpenseDate(LocalDate.of(2020, 1, 15));
        assertThrows(BusinessRuleException.class, () -> expenseService.createExpense(old));

        TestAuth.as(userRepository, "advisor");
        assertThrows(IllegalArgumentException.class, () -> periodService.reopen("2020-01", "kisa"));
        periodService.reopen("2020-01", "Duzeltme faturasi geldi, donem yeniden acildi");
        assertFalse(periodService.isClosed("2020-01"));
        assertThrows(BusinessRuleException.class, () -> periodService.close(java.time.YearMonth.now().toString(), null));
    }

    @Test
    @DisplayName("Ileri tarihli belge kabul edilmez")
    void futureDateRejected() {
        TestAuth.as(userRepository, "accountant");
        ExpenseCreateRequest r = request("Ileri Tarih", "10.00", "IT-1");
        r.setExpenseDate(LocalDate.now().plusDays(3));
        assertThrows(IllegalArgumentException.class, () -> expenseService.createExpense(r));
    }
}
