package com.gastrosync;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Notification;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.SalesService;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GastroSyncProductionE2ETests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private RecipeRepository recipeRepository;

    @Autowired
    private SalesRecordRepository salesRecordRepository;

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private SalesService salesService;

    // =========================================================================
    // SCENARIO 1: The RBAC & IDOR Penetration Test
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("1A. RBAC Test: CHEF is blocked from /api/sales/summary with HTTP 403 Forbidden")
    void testChefCannotAccessSalesSummary() throws Exception {
        String chefToken = jwtTokenProvider.generateToken(3L, "sef", "CHEF", "Fatma Kaya");

        mockMvc.perform(get("/api/sales/summary")
                .header("Authorization", "Bearer " + chefToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(2)
    @DisplayName("1B. RBAC Test: WAREHOUSE is blocked from /api/sales/summary with HTTP 403 Forbidden")
    void testWarehouseCannotAccessSalesSummary() throws Exception {
        String warehouseToken = jwtTokenProvider.generateToken(4L, "depocu", "WAREHOUSE", "Ali Çelik");

        mockMvc.perform(get("/api/sales/summary")
                .header("Authorization", "Bearer " + warehouseToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(3)
    @DisplayName("1C. RBAC Test: MANAGER / ADMIN is granted access to /api/sales/summary with HTTP 200 OK")
    void testManagerCanAccessSalesSummary() throws Exception {
        String managerToken = jwtTokenProvider.generateToken(2L, "mudur", "MANAGER", "Mehmet Demir");

        mockMvc.perform(get("/api/sales/summary")
                .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @Order(4)
    @DisplayName("1D. IDOR Patch Test: CHEF querying ?role=FINANCIAL_ADVISOR is forced to CHEF scope")
    void testIdorNotificationPatch() throws Exception {
        // Seed test notifications for both roles
        Notification chefNotif = new Notification("Mutfak Uyarısı E2E", "Bıçak seti bilendi", "CHEF", "Müdür", "GENERAL", null);
        Notification advisorNotif = new Notification("Resmi Defter Bildirimi E2E", "Vergi beyannamesi hazır", "FINANCIAL_ADVISOR", "Muhasebe", "EXPENSE_APPROVAL", null);
        notificationRepository.save(chefNotif);
        notificationRepository.save(advisorNotif);

        String chefToken = jwtTokenProvider.generateToken(3L, "sef", "CHEF", "Fatma Kaya");

        // CHEF attempts an IDOR attack: requesting FINANCIAL_ADVISOR notifications
        mockMvc.perform(get("/api/notifications?role=FINANCIAL_ADVISOR")
                .header("Authorization", "Bearer " + chefToken))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String json = result.getResponse().getContentAsString();
                    // Must NOT contain FINANCIAL_ADVISOR data
                    assertFalse(json.contains("Vergi beyannamesi hazır"), "IDOR Vulnerability Detected! Chef was able to read Financial Advisor notifications");
                });
    }

    // =========================================================================
    // SCENARIO 2: The Dynamic COGS & Inventory Lifecycle Test
    // =========================================================================

    @Test
    @Order(5)
    @DisplayName("2A. Audit Identity: recordedBy extracts from SecurityContextHolder, ignoring payload tamper")
    @WithMockUser(username = "depocu", roles = {"WAREHOUSE"})
    void testReceiveStockSecurityContextAudit() throws Exception {
        // Create an inventory item
        InventoryItem meat = new InventoryItem("Kuzu Gerdan E2E", "Et", new BigDecimal("20.0"), new BigDecimal("5.0"), "kg", new BigDecimal("350.00"), "Etçi", "869999999901", "Bugün");
        meat = inventoryItemRepository.save(meat);

        // Client payload attempts to forge recordedBy to "Hacker_Operator"
        String payload = "{\"quantity\": 10.0, \"recordedBy\": \"Hacker_Operator\"}";

        mockMvc.perform(post("/api/inventory/" + meat.getId() + "/receive")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.recordedBy").value("depocu")); // Verified extracted from SecurityContextHolder!
    }

    @Test
    @Order(6)
    @DisplayName("2B. Dynamic COGS Engine: Total Cost is dynamically calculated from OUTBOUND_SALE without hardcoded 0.285")
    void testDynamicCogsCalculation() {
        InventoryItem item = inventoryItemRepository.findAll().stream().findFirst().orElseGet(() -> {
            InventoryItem newItem = new InventoryItem("Dana Pirzola E2E", "Et", new BigDecimal("50.0"), new BigDecimal("10.0"), "kg", new BigDecimal("400.00"), "Toptan", "869999999902", "Bugün");
            return inventoryItemRepository.save(newItem);
        });

        // Insert actual OUTBOUND_SALE stock deduction of 850.00 TL
        BigDecimal ingredientCostDeduction = new BigDecimal("850.00");
        StockTransaction outboundTx = new StockTransaction(
                item,
                "OUTBOUND_SALE",
                new BigDecimal("2.125"),
                new BigDecimal("400.00"),
                "POS Satış Mutfak Düşümü: Dana Pirzola",
                "Sistem POS"
        );
        outboundTx.setTotalAmount(ingredientCostDeduction);
        stockTransactionRepository.save(outboundTx);

        // Fetch Sales Summary and verify COGS is dynamic
        Map<String, Object> summary = salesService.getSalesSummary();
        assertNotNull(summary);
        BigDecimal totalCost = (BigDecimal) summary.get("totalCost");
        assertTrue(totalCost.compareTo(BigDecimal.ZERO) > 0, "Total cost must be calculated from database");

        // Verify the repository query directly matches
        BigDecimal dbCogs = stockTransactionRepository.calculateTotalCogs();
        assertTrue(dbCogs.compareTo(ingredientCostDeduction) >= 0, "COGS must include the 850.00 TL outbound sale deduction");
        assertEquals(dbCogs.setScale(2), totalCost.setScale(2), "Sales summary total cost must strictly equal OUTBOUND_SALE total from database");
    }

    // =========================================================================
    // SCENARIO 3: The 3-Tier Financial State Machine Validation
    // =========================================================================

    @Test
    @Order(7)
    @DisplayName("3A. State Machine Lifecycle: PENDING_APPROVAL -> APPROVED -> FINALIZED")
    @WithMockUser(username = "muhasebe", roles = {"ACCOUNTANT"})
    void testExpenseStateMachineProgression() {
        // Step 1: Create expense
        ExpenseCreateRequest request = new ExpenseCreateRequest();
        request.setTitle("Endüstriyel Bulaşık Deterjanı Alımı");
        request.setCategory("VARIABLE");
        request.setSubType("CONSUMABLES");
        request.setAmount(new BigDecimal("4200.00"));
        request.setExpenseDate(LocalDate.now());

        ExpenseResponse created = expenseService.createExpense(request);
        assertNotNull(created.getId());
        assertEquals("PENDING_APPROVAL", created.getStatus());
        assertFalse(Boolean.TRUE.equals(created.getPaidByCashier()));
        assertFalse(Boolean.TRUE.equals(created.getRecordedInLedger()));

        // Step 2: Accountant / Manager approves
        ExpenseResponse approved = expenseService.approveExpense(created.getId());
        assertEquals("APPROVED", approved.getStatus());
        assertTrue(Boolean.TRUE.equals(approved.getPaidByCashier()));
        assertEquals("PAID", approved.getPaymentStatus());
        assertFalse(Boolean.TRUE.equals(approved.getRecordedInLedger()));

        // Step 3: Financial Advisor finalizes into official ledger
        ExpenseResponse finalized = expenseService.finalizeExpense(created.getId());
        assertEquals("FINALIZED", finalized.getStatus());
        assertTrue(Boolean.TRUE.equals(finalized.getRecordedInLedger()));
    }

    @Test
    @Order(8)
    @DisplayName("3B. State Machine Tamper-Proof Guard: IllegalStateException when altering or deleting FINALIZED record")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testFinalizedExpenseCannotBeAltered() {
        // Create and directly persist a FINALIZED expense
        Expense finalizedExp = new Expense();
        finalizedExp.setTitle("2026 Q3 Kurumlar Vergisi Tahakkuku");
        finalizedExp.setCategory("FIXED");
        finalizedExp.setSubType("TAX");
        finalizedExp.setAmount(new BigDecimal("125000.00"));
        finalizedExp.setPeriod("2026-10");
        finalizedExp.setExpenseDate(LocalDate.now());
        finalizedExp.setStatus("FINALIZED");
        finalizedExp.setPaymentStatus("PAID");
        finalizedExp.setPaidByCashier(true);
        finalizedExp.setRecordedInLedger(true);
        finalizedExp = expenseRepository.save(finalizedExp);

        Long expId = finalizedExp.getId();

        // Attempt 1: Attempt to approve already finalized record
        IllegalStateException approveEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.approveExpense(expId);
        });
        assertTrue(approveEx.getMessage().contains("FINALIZED") || approveEx.getMessage().contains("kesinleşmiş"));

        // Attempt 2: Attempt to finalize already finalized record
        IllegalStateException finalizeEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.finalizeExpense(expId);
        });
        assertTrue(finalizeEx.getMessage().contains("resmi deftere"));

        // Attempt 3: Attempt to reject already finalized record
        IllegalStateException rejectEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.rejectExpense(expId, "Gerekçesiz iptal girişimi");
        });
        assertTrue(rejectEx.getMessage().contains("FINALIZED") || rejectEx.getMessage().contains("Kesinleşmiş"));

        // Attempt 4: Admin attempts to delete a finalized record
        IllegalStateException deleteEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.deleteExpense(expId);
        });
        assertTrue(deleteEx.getMessage().contains("FINALIZED") || deleteEx.getMessage().contains("kesinleşmiş"));
    }

    // =========================================================================
    // SCENARIO 4: Cross-Platform Concurrency & ACID Integrity Stress Test
    // =========================================================================

    @Test
    @Order(9)
    @DisplayName("4A. Concurrency & ACID Test: Concurrent Mobile Receiving & Web Stock Adjustments")
    void testConcurrentWebAndMobileInventoryMutations() throws Exception {
        // Create a dedicated stock item
        InventoryItem flour = new InventoryItem("Organik Ekmeklik Un E2E", "Kuru Gıda", new BigDecimal("100.00"), new BigDecimal("20.00"), "kg", new BigDecimal("28.50"), "Değirmen", "869888888801", "Bugün");
        flour = inventoryItemRepository.save(flour);
        final Long flourId = flour.getId();

        // Simulate concurrent mutations across 2 threads:
        // Thread 1 (Mobile Terminal / Warehouse): Receives +50 kg of flour
        // Thread 2 (Web Terminal / Mutfak Depo): Receives +30 kg of flour
        java.util.concurrent.CompletableFuture<StockTransaction> mobileFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            return inventoryService.receiveStock(flourId, new BigDecimal("50.00"), "depocu_mobile");
        });

        java.util.concurrent.CompletableFuture<StockTransaction> webFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            return inventoryService.receiveStock(flourId, new BigDecimal("30.00"), "sef_web");
        });

        // Await completion of both ACID transactions
        java.util.concurrent.CompletableFuture.allOf(mobileFuture, webFuture).join();

        StockTransaction txMobile = mobileFuture.get();
        StockTransaction txWeb = webFuture.get();

        assertNotNull(txMobile);
        assertNotNull(txWeb);
        assertEquals("depocu_mobile", txMobile.getRecordedBy());
        assertEquals("sef_web", txWeb.getRecordedBy());

        // Verify PostgreSQL committed state: 100.00 + 50.00 + 30.00 = 180.00 kg
        InventoryItem reloaded = inventoryItemRepository.findById(flourId).orElseThrow();
        assertEquals(0, new BigDecimal("180.00").compareTo(reloaded.getCurrentStock()), "PostgreSQL must maintain strict ACID consistency without lost updates");
    }

    // =========================================================================
    // SCENARIO 5: Commercial Industry Parity (End-to-End Operational Lifecycle)
    // =========================================================================

    @Test
    @Order(10)
    @DisplayName("5A. Commercial Lifecycle: Mobile Inbound -> Recipe -> POS Sale -> Dynamic COGS -> Expense -> CPA Ledger")
    @WithMockUser(username = "advisor", roles = {"FINANCIAL_ADVISOR", "ADMIN", "ACCOUNTANT"})
    void testFullEndToEndOperationalFlow() {
        // Step 1: Mobile Inventory Receiving
        String tomatoName = "Salkım Domates E2E " + System.currentTimeMillis();
        InventoryItem tomato = new InventoryItem(tomatoName, "Sebze", new BigDecimal("50.00"), new BigDecimal("10.00"), "kg", new BigDecimal("32.00"), "Hal Toptan", "86977" + System.currentTimeMillis() % 10000000, "Bugün");
        tomato = inventoryItemRepository.save(tomato);

        StockTransaction inboundTx = inventoryService.receiveStock(tomato.getId(), new BigDecimal("25.00"), "depocu_mobile");
        assertNotNull(inboundTx.getId());
        assertEquals("INBOUND", inboundTx.getType());

        // Step 2: Chef Recipe Creation (Uses 0.200 kg of Salkım Domates per portion)
        String pastaRecipeName = "Napoliten Soslu Penne E2E " + System.currentTimeMillis();
        String recipeJson = "[{\"name\":\"" + tomatoName + "\",\"quantity\":0.200,\"unit\":\"kg\"}]";
        Recipe pastaRecipe = new Recipe(pastaRecipeName, "Makarna", new BigDecimal("220.00"), 1, "Taze domates soslu", recipeJson);
        pastaRecipe = recipeRepository.save(pastaRecipe);
        assertNotNull(pastaRecipe.getId());

        // Step 3: Web POS Sale Registration (5 portions sold = 1.000 kg tomato consumed)
        SalesRecord posSale = new SalesRecord(
                "ORD-E2E-" + System.currentTimeMillis(),
                "19:45",
                pastaRecipeName,
                5,
                new BigDecimal("220.00"),
                new BigDecimal("1100.00"),
                "Masa 4",
                "Kredi Kartı"
        );
        SalesRecord recordedSale = salesService.recordSale(posSale);
        assertNotNull(recordedSale.getId());

        // Step 4: Verify Recipe-to-Stock Automatic Deduction in PostgreSQL
        InventoryItem reloadedTomato = inventoryItemRepository.findById(tomato.getId()).orElseThrow();
        // Initial 50 + 25 inbound = 75 kg. Deduct 5 * 0.200 = 1.000 kg -> Expected: 74.00 kg
        assertEquals(0, new BigDecimal("74.00").compareTo(reloadedTomato.getCurrentStock()), "Recipe-to-Stock deduction must decrement 1.000 kg from tomato inventory");

        // Step 5: Verify Dynamic COGS Engine (1.000 kg * 32.00 TL/kg = 32.00 TL added to COGS)
        Map<String, Object> salesSummary = salesService.getSalesSummary();
        assertNotNull(salesSummary);
        BigDecimal totalCost = (BigDecimal) salesSummary.get("totalCost");
        assertTrue(totalCost.compareTo(new BigDecimal("32.00")) >= 0, "COGS must include the 32.00 TL recipe deduction");

        // Step 6: Expense Creation for Hal Toptancı Invoice (25 kg * 32 TL = 800.00 TL)
        ExpenseCreateRequest expenseReq = new ExpenseCreateRequest();
        expenseReq.setTitle("Hal Toptancı Sebze Tedarik Faturası");
        expenseReq.setCategory("VARIABLE");
        expenseReq.setSubType("CONSUMABLES");
        expenseReq.setAmount(new BigDecimal("800.00"));
        expenseReq.setCounterparty("Hal Toptan A.Ş.");
        expenseReq.setExpenseDate(LocalDate.now());

        ExpenseResponse createdExpense = expenseService.createExpense(expenseReq);
        assertEquals("PENDING_APPROVAL", createdExpense.getStatus());

        // Step 7: Cashier / Manager Approves & Pays
        ExpenseResponse approvedExpense = expenseService.approveExpense(createdExpense.getId());
        assertEquals("APPROVED", approvedExpense.getStatus());
        assertEquals("PAID", approvedExpense.getPaymentStatus());

        // Step 8: SMMM Financial Advisor Finalizes into Fiscal Ledger
        ExpenseResponse finalizedExpense = expenseService.finalizeExpense(approvedExpense.getId());
        assertEquals("FINALIZED", finalizedExpense.getStatus());
        assertTrue(Boolean.TRUE.equals(finalizedExpense.getRecordedInLedger()), "Expense must be permanently locked in the fiscal ledger");
    }

    @Test
    @Order(11)
    @DisplayName("5B. Phase 3 Scenario: Mobile Warehouse (50kg Beef) -> Web Chef (Steak Recipe) -> Web POS (4 Plates Sold = 1kg deducted) -> Web Manager (Edit & Approve Invoice) -> Web Advisor (Finalize & Block Delete)")
    @WithMockUser(username = "advisor", roles = {"FINANCIAL_ADVISOR", "ADMIN", "ACCOUNTANT", "MANAGER", "WAREHOUSE", "CHEF"})
    void testPhase3ConcurrentMultiDeviceLiveSyncScenario() {
        // Step 1: Mobile (Warehouse): Scans/Receives 50.00 kg Beef
        String beefName = "Dana Antrikot Phase3 " + System.currentTimeMillis();
        InventoryItem beefItem = new InventoryItem(beefName, "Et Ürünleri", BigDecimal.ZERO, new BigDecimal("5.00"), "kg", new BigDecimal("450.00"), "Et Toptan A.Ş.", "86900" + System.currentTimeMillis() % 10000000, "Bugün");
        beefItem = inventoryItemRepository.save(beefItem);

        StockTransaction mobileTx = inventoryService.receiveStock(beefItem.getId(), new BigDecimal("50.00"), "depocu_mobile_app");
        assertNotNull(mobileTx.getId());
        assertEquals("INBOUND", mobileTx.getType());
        assertEquals("depocu_mobile_app", mobileTx.getRecordedBy());

        InventoryItem currentBeef = inventoryItemRepository.findById(beefItem.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("50.00").compareTo(currentBeef.getCurrentStock()), "Mobile receiving must immediately update stock to 50.00 kg");

        // Step 2: Web (Chef): Adds new recipe "Steak Plate" using "0.250 kg Beef"
        String steakRecipeName = "Steak Plate Phase3 " + System.currentTimeMillis();
        String steakBOM = "[{\"name\":\"" + beefName + "\",\"quantity\":0.250,\"unit\":\"kg\"}]";
        Recipe steakRecipe = new Recipe(steakRecipeName, "Ana Yemek", new BigDecimal("380.00"), 1, "Özel marine edilmiş antrikot", steakBOM);
        steakRecipe = recipeRepository.save(steakRecipe);
        assertNotNull(steakRecipe.getId());

        // Step 3: Web (Accountant): Clicks POS/Sales, sells 4 "Steak Plates"
        SalesRecord posSale = new SalesRecord(
                "ORD-STEAK-" + System.currentTimeMillis(),
                "20:15",
                steakRecipeName,
                4,
                new BigDecimal("380.00"),
                new BigDecimal("1520.00"),
                "Masa 7",
                "Kredi Kartı"
        );
        SalesRecord recordedSale = salesService.recordSale(posSale);
        assertNotNull(recordedSale.getId());

        // Verify that exactly 1.000 kg of beef (4 * 0.250 kg) is instantly deducted from central inventory (leaves 49.00 kg)
        InventoryItem beefAfterSale = inventoryItemRepository.findById(beefItem.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("49.00").compareTo(beefAfterSale.getCurrentStock()), "Central inventory must reflect 49.00 kg (1.000 kg deducted)");

        // Step 4: Web (Manager): Edits a pending supplier invoice, types a new amount, and clicks "APPROVE"
        ExpenseCreateRequest initialInvoice = new ExpenseCreateRequest();
        initialInvoice.setTitle("Et Tedarik Faturası No 4048");
        initialInvoice.setCategory("VARIABLE");
        initialInvoice.setSubType("RAW_MATERIAL");
        initialInvoice.setAmount(new BigDecimal("22500.00"));
        initialInvoice.setCounterparty("Et Toptan A.Ş.");
        initialInvoice.setExpenseDate(LocalDate.now());

        ExpenseResponse invoice = expenseService.createExpense(initialInvoice);
        assertEquals("PENDING_APPROVAL", invoice.getStatus());

        // Manager edits amount from 22500.00 to 22000.00
        ExpenseCreateRequest updateReq = new ExpenseCreateRequest();
        updateReq.setTitle("Et Tedarik Faturası No 4048 (Revize)");
        updateReq.setCategory("VARIABLE");
        updateReq.setSubType("RAW_MATERIAL");
        updateReq.setAmount(new BigDecimal("22000.00"));
        updateReq.setCounterparty("Et Toptan A.Ş.");
        updateReq.setExpenseDate(LocalDate.now());

        ExpenseResponse editedInvoice = expenseService.updateExpense(invoice.getId(), updateReq);
        assertEquals(0, new BigDecimal("22000.00").compareTo(editedInvoice.getAmount()), "Pending invoice amount successfully updated to 22,000.00 TL");

        // Manager approves the invoice
        ExpenseResponse approvedInvoice = expenseService.approveExpense(editedInvoice.getId());
        assertEquals("APPROVED", approvedInvoice.getStatus());
        assertEquals("PAID", approvedInvoice.getPaymentStatus());

        // Step 5: Web (Financial Advisor): Finalizes invoice, then attempts DELETE to prove tamper-proof lock
        ExpenseResponse finalized = expenseService.finalizeExpense(approvedInvoice.getId());
        assertEquals("FINALIZED", finalized.getStatus());
        assertTrue(Boolean.TRUE.equals(finalized.getRecordedInLedger()));

        // Tamper verification: Attempting DELETE must throw IllegalStateException
        IllegalStateException deleteEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.deleteExpense(finalized.getId());
        });
        assertTrue(deleteEx.getMessage().contains("FINALIZED"), "Deletion of finalized ledger record must be blocked");

        // Tamper verification: Attempting UPDATE must also throw IllegalStateException
        IllegalStateException updateEx = assertThrows(IllegalStateException.class, () -> {
            expenseService.updateExpense(finalized.getId(), updateReq);
        });
        assertTrue(updateEx.getMessage().contains("FINALIZED"), "Update of finalized ledger record must be blocked");
    }
}

