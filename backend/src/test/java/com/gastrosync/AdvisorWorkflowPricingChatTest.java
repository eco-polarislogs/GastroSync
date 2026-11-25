package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.ChatService;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.PricingService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.support.TestAuth;

/**
 * Muhasebe -> Mali Musavir gonderim akisi, yonetici yetkisi, maliyet dalgalanmasi uyarilari,
 * menu fiyat analizi ve sohbet okunma senkronu.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AdvisorWorkflowPricingChatTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ExpenseService expenseService;
    @Autowired private InventoryService inventoryService;
    @Autowired private RecipeService recipeService;
    @Autowired private PricingService pricingService;
    @Autowired private ChatService chatService;
    @Autowired private AppUserRepository userRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private JwtTokenProvider jwt;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private String auth(String username) {
        return TestAuth.bearer(userRepository, jwt, username);
    }

    private ExpenseCreateRequest request(String title, String invoice) {
        ExpenseCreateRequest r = new ExpenseCreateRequest();
        r.setTitle(title);
        r.setCategory("VARIABLE");
        r.setSubType("ELECTRICITY");
        r.setAmount(new BigDecimal("960.00"));
        r.setExpenseDate(LocalDate.now());
        r.setInvoiceNumber(invoice);
        r.setVatRate(new BigDecimal("20"));
        return r;
    }

    private ExpenseResponse approvedExpense(String title) {
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse created = expenseService.createExpense(request(title, null));
        TestAuth.as(userRepository, "manager");
        ExpenseResponse approved = expenseService.approveExpense(created.getId());
        assertEquals(Expense.STATUS_APPROVED, approved.getStatus());
        assertFalse(approved.getSentToAdvisor(), "Onay kaydi Mali Musavire otomatik gondermemeli");
        return approved;
    }

    @Test
    @DisplayName("Muhasebe oder, faturalandirir ve gonderir; Mali Musavir yalnizca gonderilen belgeyi onaylar veya gerekceli reddeder")
    void accountantSubmitsAdvisorDecides() {
        ExpenseResponse e = approvedExpense("Musavir Akisi " + System.nanoTime());

        TestAuth.as(userRepository, "advisor");
        assertThrows(BusinessRuleException.class, () -> expenseService.finalizeExpense(e.getId()), "Gonderilmeden deftere islenemez");
        assertThrows(BusinessRuleException.class, () -> expenseService.rejectExpense(e.getId(), "Henuz gonderilmemis kayit"));

        TestAuth.as(userRepository, "accountant");
        expenseService.payExpense(e.getId(), null, "BANK_TRANSFER", "Dekont 1");
        BusinessRuleException noDoc = assertThrows(BusinessRuleException.class,
                () -> expenseService.submitToAdvisor(e.getId(), null, null, null));
        assertTrue(noDoc.getMessage().contains("Belge duzeni"));
        ExpenseResponse sent = expenseService.submitToAdvisor(e.getId(), "ELK-2026-11", "Enerjisa", "Dekont ekte");
        assertTrue(sent.getSentToAdvisor());
        assertEquals("ELK-2026-11", sent.getInvoiceNumber());
        assertEquals("Enerjisa", sent.getCounterparty());
        assertThrows(BusinessRuleException.class, () -> expenseService.submitToAdvisor(e.getId(), null, null, null));
        // Inceleme sirasinda muhasebe kaydi kendisi reddedemez (yetkisiz islem olarak raporlanir)
        assertThrows(AccessDeniedException.class, () -> expenseService.rejectExpense(e.getId(), "Muhasebe geri cekme denemesi"));

        TestAuth.as(userRepository, "advisor");
        assertThrows(IllegalArgumentException.class, () -> expenseService.rejectExpense(e.getId(), "kisa"));
        ExpenseResponse rejected = expenseService.rejectExpense(e.getId(), "Fatura uzerindeki vergi numarasi hatali");
        assertEquals(Expense.STATUS_REJECTED, rejected.getStatus());
        assertFalse(rejected.getSentToAdvisor());
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> n.getTitle() != null
                && n.getTitle().startsWith("Mali Musavir Reddetti") && e.getId().equals(n.getRelatedEntityId())));

        // Duzeltme -> tekrar onay -> tekrar gonderim -> Mali Musavir onayi
        TestAuth.as(userRepository, "accountant");
        ExpenseCreateRequest fix = request(e.getTitle(), "ELK-2026-11B");
        fix.setCounterparty("Enerjisa");
        assertEquals(Expense.STATUS_PENDING, expenseService.updateExpense(e.getId(), fix).getStatus());
        TestAuth.as(userRepository, "manager");
        expenseService.approveExpense(e.getId());
        TestAuth.as(userRepository, "accountant");
        expenseService.submitToAdvisor(e.getId(), null, null, null);
        TestAuth.as(userRepository, "advisor");
        ExpenseResponse done = expenseService.finalizeExpense(e.getId(), "Belge uygun");
        assertEquals(Expense.STATUS_FINALIZED, done.getStatus());
        assertEquals("Belge uygun", done.getAdvisorNote());
    }

    @Test
    @DisplayName("Hicbir rol digerinin isini yapamaz: Yonetici defter onayi / odeme / gonderim / donem kapama yapamaz")
    void noRoleDoesAnotherRolesJob() throws Exception {
        ExpenseResponse e = approvedExpense("Ayrilik " + System.nanoTime());
        TestAuth.as(userRepository, "accountant");
        expenseService.submitToAdvisor(e.getId(), "FT-77", "Enerjisa", null);

        // Mali Musavirin isi: yalnizca Mali Musavir deftere isler
        for (String u : new String[]{"admin", "manager", "accountant", "cashier", "chef", "warehouse"}) {
            mvc.perform(put("/api/expenses/" + e.getId() + "/finalize").header("Authorization", auth(u)))
                    .andExpect(status().isForbidden());
        }
        // Mudur, Mali Musavir incelemesindeki kaydi reddedemez (servis kurali)
        mvc.perform(put("/api/expenses/" + e.getId() + "/reject").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Mudur bu kaydi geri cekmek istiyor\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/expenses/" + e.getId() + "/finalize").header("Authorization", auth("advisor"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Belge uygun\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FINALIZED"));

        // Muhasebenin isi: kayit, odeme, gonderim. Mali Musavir ve Yonetici yapamaz.
        String body = objectMapper.writeValueAsString(request("Yetkisiz Kayit " + System.nanoTime(), "FT-80"));
        for (String u : new String[]{"admin", "manager", "advisor", "cashier"}) {
            mvc.perform(post("/api/expenses").header("Authorization", auth(u)).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
        }
        ExpenseResponse other = approvedExpense("Odeme Ayrimi " + System.nanoTime());
        for (String u : new String[]{"admin", "manager", "advisor"}) {
            mvc.perform(post("/api/expenses/" + other.getId() + "/pay").header("Authorization", auth(u))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/expenses/" + other.getId() + "/submit").header("Authorization", auth(u))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isForbidden());
        }
        // Mudurun isi: harcama onayi. Muhasebe, Yonetici ve Mali Musavir onaylayamaz.
        TestAuth.as(userRepository, "accountant");
        ExpenseResponse pending = expenseService.createExpense(request("Onay Ayrimi " + System.nanoTime(), "FT-81"));
        for (String u : new String[]{"admin", "accountant", "advisor", "chef"}) {
            mvc.perform(put("/api/expenses/" + pending.getId() + "/approve").header("Authorization", auth(u)))
                    .andExpect(status().isForbidden());
        }
        // Mali Musavir onay asamasindaki kaydi reddedemez (henuz ona gonderilmedi)
        mvc.perform(put("/api/expenses/" + pending.getId() + "/reject").header("Authorization", auth("advisor"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Henuz gonderilmemis kayit\"}"))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/expenses/" + pending.getId() + "/approve").header("Authorization", auth("manager")))
                .andExpect(status().isOk());

        // Donem kapama yalnizca Mali Musavir: Yonetici icin yetki reddi
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/accounting/periods/bad/close")
                        .header("Authorization", auth("admin")))
                .andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/accounting/periods/bad/close")
                        .header("Authorization", auth("advisor")))
                .andExpect(status().isBadRequest());
        // Gonderim ucu: sef yetkisiz
        mvc.perform(put("/api/expenses/" + other.getId() + "/submit").header("Authorization", auth("chef")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Alis fiyati artisi etkilenen receteleri bildirir; analiz onerilen fiyati ve menu sinifini verir")
    void purchasePriceChangeAndMenuPricing() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItemRequest req = new InventoryItemRequest();
        String itemName = "Fiyat Testi Somon " + System.nanoTime();
        req.setName(itemName);
        req.setCategory("Balik");
        req.setCurrentStock(new BigDecimal("10"));
        req.setMinStock(new BigDecimal("1"));
        req.setUnit("kg");
        req.setUnitCost(new BigDecimal("400.00"));
        req.setSupplier("Balikci");
        InventoryItem item = inventoryService.createItem(req);

        Recipe r = new Recipe();
        String recipeName = "Fiyat Testi Kase " + System.nanoTime();
        r.setName(recipeName);
        r.setCategory("Ana Yemek");
        r.setSalePrice(new BigDecimal("440.00"));
        r.setPortions(1);
        r.setVatRate(new BigDecimal("10"));
        r.setIngredientsJson(objectMapper.writeValueAsString(List.of(Map.of("itemId", item.getId(), "quantity", "0.25"))));
        Recipe recipe = recipeService.createRecipe(r);
        assertEquals(0, new BigDecimal("100.00").compareTo(recipe.getPortionCost()));

        // %30 artisli mal kabul -> PRICE_CHANGE bildirimi (recete ve porsiyon etkisi ile)
        TestAuth.as(userRepository, "warehouse");
        inventoryService.receiveStock(item.getId(), new BigDecimal("5"), new BigDecimal("520.00"), "BLK-1", null);
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> "PRICE_CHANGE".equals(n.getType())
                && n.getMessage() != null && n.getMessage().contains(recipeName) && n.getMessage().contains("30")));

        // Kucuk dalgalanma esigin altinda bildirim uretmez
        long before = notificationRepository.findAll().stream().filter(n -> "PRICE_CHANGE".equals(n.getType())).count();
        inventoryService.receiveStock(item.getId(), new BigDecimal("1"), new BigDecimal("525.00"), "BLK-2", null);
        long after = notificationRepository.findAll().stream().filter(n -> "PRICE_CHANGE".equals(n.getType())).count();
        assertEquals(before, after);

        TestAuth.as(userRepository, "accountant");
        Map<String, Object> analysis = pricingService.menuPricing(30);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recipes = (List<Map<String, Object>>) analysis.get("recipes");
        Map<String, Object> row = recipes.stream().filter(x -> recipeName.equals(x.get("name"))).findFirst().orElseThrow();
        // Son alis 525 TL/kg x 0.25 = 131.25 TL; hedef %30 -> net 437.5, KDV dahil 481.25 -> 485 TL
        assertEquals(0, new BigDecimal("131.25").compareTo((BigDecimal) row.get("replacementCost")));
        assertEquals(0, new BigDecimal("485.00").compareTo((BigDecimal) row.get("suggestedPrice")));
        assertTrue(List.of("RAISE", "LOSS").contains(row.get("priceAction")), "Food cost hedefin uzerinde: " + row.get("priceAction"));
        assertTrue(((BigDecimal) row.get("costChangePercent")).compareTo(new BigDecimal("30")) > 0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ingredients = (List<Map<String, Object>>) analysis.get("ingredients");
        Map<String, Object> ing = ingredients.stream().filter(x -> itemName.equals(x.get("name"))).findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("525.00").compareTo((BigDecimal) ing.get("lastPurchaseCost")));
        assertEquals(0, new BigDecimal("1.0").compareTo((BigDecimal) ing.get("changePercent")));
        assertTrue(((Map<?, ?>) analysis.get("summary")).containsKey("overheadPerPortion"), "Mali yetkili genel gider payini gorur");

        // Sef analizi gorur ama gelir-gider (genel gider payi) bilgisini goremez
        mvc.perform(get("/api/analytics/menu-pricing").header("Authorization", auth("chef")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.financeView").value(false))
                .andExpect(jsonPath("$.data.summary.overheadPerPortion").doesNotExist());
        mvc.perform(get("/api/analytics/menu-pricing").header("Authorization", auth("warehouse")))
                .andExpect(status().isForbidden());

        // Fiyat guncelleme: sef yetkisiz, mudur gerekceli gunceller
        mvc.perform(put("/api/recipes/" + recipe.getId() + "/price").header("Authorization", auth("chef"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"salePrice\":485}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/recipes/" + recipe.getId() + "/price").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"salePrice\":485,\"reason\":\"Somon alis fiyati artti\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.salePrice").value(485.0));
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> "MENU_PRICE".equals(n.getType())
                && n.getTitle().contains(recipeName)));
    }

    @Test
    @DisplayName("Sohbet okunma durumu: kendi mesaji sayilmaz, okundu bilgisi kullaniciya ozel ve kanal yetkisine bagli")
    void chatUnreadSync() throws Exception {
        AuthenticatedUser manager = TestAuth.as(userRepository, "manager");
        long base = chatService.unreadCounts(manager).getOrDefault("general", 0L);
        AuthenticatedUser accountant = TestAuth.as(userRepository, "accountant");
        long accountantBase = chatService.unreadCounts(accountant).getOrDefault("general", 0L);

        chatService.send(accountant, "general", "Okunma senkron testi " + System.nanoTime(), "normal");

        assertEquals(base + 1, chatService.unreadCounts(manager).get("general"));
        assertEquals(accountantBase, chatService.unreadCounts(accountant).get("general"), "Kendi mesaji okunmamis sayilmaz");

        Map<String, Object> read = chatService.markRead(manager, "general", null);
        assertEquals(0L, ((Number) read.get("unread")).longValue());
        assertEquals(0L, chatService.unreadCounts(manager).get("general"));

        mvc.perform(get("/api/chat/unread").header("Authorization", auth("advisor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.general").exists())
                .andExpect(jsonPath("$.data.kitchen").doesNotExist());
        mvc.perform(put("/api/chat/channels/kitchen/read").header("Authorization", auth("advisor")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/chat/channels/general/read").header("Authorization", auth("advisor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unread").value(0));
    }
}
