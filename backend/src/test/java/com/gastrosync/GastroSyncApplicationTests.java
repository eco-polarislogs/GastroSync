package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.mapper.ExpenseMapper;
import com.gastrosync.model.Expense;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.security.PasswordPolicy;
import com.gastrosync.service.ExpenseCatalog;

@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
class GastroSyncApplicationTests {

    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private ExpenseMapper expenseMapper;

    @Test
    @DisplayName("Uygulama baglami yuklenir")
    void contextLoads() {
        assertTrue(true);
    }

    @Test
    @DisplayName("BCrypt: ayni sifre farkli tuz ile farkli ozet uretir")
    void passwordHashing() {
        String h1 = passwordEncoder.encode("Sifre2026");
        String h2 = passwordEncoder.encode("Sifre2026");
        assertNotEquals(h1, h2);
        assertTrue(passwordEncoder.matches("Sifre2026", h1));
        assertFalse(passwordEncoder.matches("yanlis", h1));
    }

    @Test
    @DisplayName("JWT: uretim, dogrulama ve tahrifat tespiti")
    void jwtLifecycle() {
        String token = jwtTokenProvider.generateToken(7L, "chef", "CHEF", "Mehmet Sef");
        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals("chef", jwtTokenProvider.getUsername(token));
        assertEquals(7L, jwtTokenProvider.getUserId(token));
        String tampered = token.substring(0, token.length() - 3) + (token.endsWith("aaa") ? "bbb" : "aaa");
        assertFalse(jwtTokenProvider.validateToken(tampered));
        assertFalse(jwtTokenProvider.validateToken("gecersiz.token.degeri"));
    }

    @Test
    @DisplayName("Sifre politikasi: en az 8 karakter, harf ve rakam")
    void passwordPolicy() {
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.validate("123456"));
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.validate("sadeceharf"));
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.validate("12345678"));
        PasswordPolicy.validate("Gastro2026");
    }

    @Test
    @DisplayName("Gider KDV ayristirma ve DTO projeksiyonu")
    void expenseVatAndMapping() {
        Expense e = new Expense("Elektrik", "VARIABLE", "ELECTRICITY", new BigDecimal("1200.00"), null, LocalDate.of(2026, 3, 5), "Test", null);
        e.setVatRate(new BigDecimal("20"));
        assertEquals(new BigDecimal("200.00"), e.getVatAmount());
        assertEquals(new BigDecimal("1000.00"), e.getNetAmount());
        assertEquals("2026-03", Expense.periodOf(e.getExpenseDate()));
        ExpenseResponse dto = expenseMapper.toDto(e);
        assertEquals(new BigDecimal("200.00"), dto.getVatAmount());
        assertEquals(new BigDecimal("1200.00"), dto.getRemainingAmount());
    }

    @Test
    @DisplayName("Gider turu katalogu: hammadde stok, vergi faaliyet gideri degildir")
    void expenseCatalog() {
        assertFalse(ExpenseCatalog.require("RAW_MATERIAL").profitAndLoss());
        assertEquals("150", ExpenseCatalog.require("RAW_MATERIAL").accountCode());
        assertFalse(ExpenseCatalog.require("TAX").profitAndLoss());
        assertEquals("770", ExpenseCatalog.require("RENT").accountCode());
        assertThrows(IllegalArgumentException.class, () -> ExpenseCatalog.require("UYDURMA"));
    }

    @Test
    @DisplayName("WebSocket abonelik politikasi varsayilan olarak kapalidir")
    void subscriptionPolicy() {
        assertTrue(AppRoles.canSubscribe("CHEF", "/topic/chat/kitchen"));
        assertFalse(AppRoles.canSubscribe("CHEF", "/topic/chat/cashier"));
        assertFalse(AppRoles.canSubscribe("WAREHOUSE", "/topic/chat/management"));
        assertTrue(AppRoles.canSubscribe("ACCOUNTANT", "/topic/notifications/ACCOUNTANT"));
        assertFalse(AppRoles.canSubscribe("CHEF", "/topic/notifications/FINANCIAL_ADVISOR"));
        assertFalse(AppRoles.canSubscribe("CHEF", "/topic/notifications/supervisors"));
        assertFalse(AppRoles.canSubscribe("MANAGER", "/topic/notifications/supervisors"));
        assertTrue(AppRoles.canSubscribe("ADMIN", "/topic/notifications/supervisors"));
        assertTrue(AppRoles.canSubscribe("CASHIER", "/topic/tables"));
        assertFalse(AppRoles.canSubscribe("ACCOUNTANT", "/topic/tables"));
        assertFalse(AppRoles.canSubscribe("WAREHOUSE", "/topic/finance"));
        assertTrue(AppRoles.canSubscribe("FINANCIAL_ADVISOR", "/topic/finance"));
        assertFalse(AppRoles.canSubscribe("ADMIN", "/topic/chat/all"));
        assertFalse(AppRoles.canSubscribe("ADMIN", "/topic/bilinmeyen"));
        assertFalse(AppRoles.canSubscribe(null, "/topic/notifications"));
    }
}
