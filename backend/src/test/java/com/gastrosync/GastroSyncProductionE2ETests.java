package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.model.CashClosing;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.service.ReportService;
import com.gastrosync.service.SalesService;
import com.gastrosync.support.TestAuth;

/**
 * Uctan uca ticari dongu: tedarik talebi -> onay -> odeme -> mal kabul -> recete -> satis
 * -> mali musavir defteri -> raporlar (yevmiye dengesi, KDV, Z raporu, kasa sayimi).
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
class GastroSyncProductionE2ETests {

    @Autowired private InventoryService inventoryService;
    @Autowired private RecipeService recipeService;
    @Autowired private SalesService salesService;
    @Autowired private ExpenseService expenseService;
    @Autowired private ReportService reportService;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    @Test
    @DisplayName("Tedarik -> mal kabul -> satis -> defter -> dengeli yevmiye ve tutarli raporlar")
    void fullCommercialCycle() throws Exception {
        // 1. Depo stok karti acar
        TestAuth.as(userRepository, "warehouse");
        InventoryItemRequest req = new InventoryItemRequest();
        req.setName("E2E Kuzu Pirzola " + System.nanoTime());
        req.setCategory("Et");
        req.setCurrentStock(new BigDecimal("2"));
        req.setMinStock(new BigDecimal("1"));
        req.setUnit("kg");
        req.setUnitCost(new BigDecimal("600.00"));
        req.setSupplier("Kasap Ahmet");
        InventoryItem lamb = inventoryService.createItem(req);

        // 2. Sef tedarik talebi acar -> muhasebe onayina tahmini tutarli kayit
        TestAuth.as(userRepository, "chef");
        ExpenseResponse purchase = expenseService.createPurchaseRequest(lamb.getId(), new BigDecimal("10"), true, "Hafta sonu menusu");
        assertEquals("RAW_MATERIAL", purchase.getSubType());
        assertEquals(0, new BigDecimal("6000.00").compareTo(purchase.getAmount()));

        // 3. Muhasebe fatura geldikten sonra tutari ve belgeyi gunceller
        TestAuth.as(userRepository, "accountant");
        com.gastrosync.dto.expense.ExpenseCreateRequest upd = new com.gastrosync.dto.expense.ExpenseCreateRequest();
        upd.setTitle(purchase.getTitle());
        upd.setCategory("VARIABLE");
        upd.setSubType("RAW_MATERIAL");
        upd.setAmount(new BigDecimal("6060.00"));
        upd.setVatRate(new BigDecimal("1"));
        upd.setInvoiceNumber("KSP-2026-77");
        upd.setCounterparty("Kasap Ahmet");
        upd.setExpenseDate(LocalDate.now());
        expenseService.updateExpense(purchase.getId(), upd);

        // 4. Mudur onaylar, muhasebe oder
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(purchase.getId());
        TestAuth.as(userRepository, "accountant");
        expenseService.payExpense(purchase.getId(), null, "BANK_TRANSFER", "Havale");
        expenseService.submitToAdvisor(purchase.getId(), null, null, "Havale dekontu ekte");

        // 5. Depo bekleyen teslimati gorur ve faturadaki birim fiyatla mal kabul yapar
        TestAuth.as(userRepository, "warehouse");
        assertTrue(inventoryService.getPendingDeliveries().stream().anyMatch(d -> purchase.getId().equals(d.get("expenseId"))));
        inventoryService.receiveStock(lamb.getId(), new BigDecimal("10"), new BigDecimal("600.00"), "KSP-2026-77", purchase.getId());
        assertTrue(inventoryService.getPendingDeliveries().stream().noneMatch(d -> purchase.getId().equals(d.get("expenseId"))));

        // 6. Mudur recete tanimlar, kasa satis yapar
        TestAuth.as(userRepository, "manager");
        Recipe r = new Recipe();
        r.setName("E2E Pirzola Tabagi " + System.nanoTime());
        r.setCategory("Ana Yemek");
        r.setSalePrice(new BigDecimal("880.00"));
        r.setPortions(1);
        r.setVatRate(new BigDecimal("10"));
        r.setIngredientsJson(objectMapper.writeValueAsString(List.of(Map.of("itemId", lamb.getId(), "quantity", "0.3"))));
        Recipe recipe = recipeService.createRecipe(r);
        assertEquals(0, new BigDecimal("180.00").compareTo(recipe.getPortionCost()));
        assertEquals(0, new BigDecimal("22.5").compareTo(recipe.getFoodCostPercent())); // 180 / 800 (KDV haric)

        TestAuth.as(userRepository, "accountant");
        salesService.recordOrder("Masa 8", "CASH", null, List.of(new SalesService.OrderLine(recipe.getId(), null, 5)));

        // 7. Mali musavir faturayi deftere isler
        TestAuth.as(userRepository, "advisor");
        expenseService.finalizeExpense(purchase.getId());

        // 8. Raporlar
        Map<String, Object> journal = reportService.journal(YearMonth.now().toString());
        assertEquals(Boolean.TRUE, journal.get("balanced"), "Yevmiye borc/alacak dengesi bozuk");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> entries = (List<Map<String, Object>>) journal.get("entries");
        assertTrue(entries.stream().allMatch(e -> Boolean.TRUE.equals(e.get("balanced"))));
        assertTrue(entries.stream().anyMatch(e -> e.get("description").toString().contains("KSP-2026-77")));

        Map<String, Object> summary = reportService.periodSummary(null);
        assertTrue(((BigDecimal) summary.get("grossRevenue")).compareTo(new BigDecimal("4400.00")) >= 0);
        assertTrue(((BigDecimal) summary.get("cogs")).compareTo(new BigDecimal("900.00")) >= 0);

        Map<String, Object> vat = reportService.vatReport(null);
        assertTrue(((BigDecimal) vat.get("totalOutputVat")).compareTo(new BigDecimal("400.00")) >= 0);
        assertTrue(((BigDecimal) vat.get("totalInputVat")).compareTo(new BigDecimal("60.00")) >= 0);

        // 9. Kor kasa sayimi: ilk sayim her zaman kaydedilir; fark aciklamasi sonradan ve yalnizca sayan kisice girilir
        TestAuth.as(userRepository, "accountant");
        Map<String, Object> z = reportService.zReport(LocalDate.now());
        BigDecimal expected = (BigDecimal) z.get("expectedCashExcludingFloat");
        CashClosing closing = reportService.createCashClosing(LocalDate.now(), BigDecimal.ZERO,
                expected.subtract(new BigDecimal("50")), null);
        assertEquals(0, new BigDecimal("-50.00").compareTo(closing.getDifference()));
        assertThrows(IllegalArgumentException.class, () -> reportService.addCashClosingExplanation(closing.getId(), "abc"));
        CashClosing explained = reportService.addCashClosingExplanation(closing.getId(), "Bozuk para ustu farki");
        assertEquals("Bozuk para ustu farki", explained.getNote());
        // Aciklamasiz fark onaylanamaz; baska kullanici (mudur) aciklama ekleyemez
        TestAuth.as(userRepository, "manager");
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> reportService.addCashClosingExplanation(closing.getId(), "Baskasinin aciklamasi"));
    }
}
