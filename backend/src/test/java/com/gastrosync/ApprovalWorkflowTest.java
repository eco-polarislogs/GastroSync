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
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.ApprovalRequest;
import com.gastrosync.model.CheckItem;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.ApprovalRequestRepository;
import com.gastrosync.repository.CheckItemRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.ApprovalService;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.PosService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.support.TestAuth;

/**
 * Roller arasi onay zinciri: Kasiyer iptal / ikram / indirim talebi -> Mudur onay / ret,
 * Depo esigi asan sayim farki -> Mudur onay / ret. Talep acan kendi talebine karar veremez,
 * Yonetici (salt okunur gozetim) karar veremez, bekleyen talep varken tahsilat yapilamaz.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class ApprovalWorkflowTest {

    private static final AtomicInteger TABLE_NO = new AtomicInteger(700 + (int) (System.nanoTime() % 100));

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JwtTokenProvider jwt;
    @Autowired private PosService posService;
    @Autowired private ApprovalService approvalService;
    @Autowired private InventoryService inventoryService;
    @Autowired private RecipeService recipeService;
    @Autowired private InventoryItemRepository itemRepository;
    @Autowired private CheckItemRepository checkItemRepository;
    @Autowired private ApprovalRequestRepository approvalRepository;
    @Autowired private SalesRecordRepository salesRepository;
    @Autowired private NotificationRepository notificationRepository;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private String auth(String username) {
        return TestAuth.bearer(userRepository, jwt, username);
    }

    private InventoryItem stockItem(String name, String stock, String cost) {
        TestAuth.as(userRepository, "warehouse");
        InventoryItemRequest r = new InventoryItemRequest();
        r.setName(name + " " + System.nanoTime());
        r.setCategory("Test");
        r.setCurrentStock(new BigDecimal(stock));
        r.setMinStock(BigDecimal.ONE);
        r.setUnit("kg");
        r.setUnitCost(new BigDecimal(cost));
        r.setSupplier("Test Tedarik");
        return inventoryService.createItem(r);
    }

    /** Sef recete yazar, Mudur fiyati onaylar (kasada satisa acilir) */
    private Recipe approvedRecipe(String name, String price, InventoryItem item) throws Exception {
        TestAuth.as(userRepository, "chef");
        Recipe r = new Recipe();
        r.setName(name + " " + System.nanoTime());
        r.setCategory("Ana Yemek");
        r.setSalePrice(new BigDecimal(price));
        r.setPortions(1);
        r.setVatRate(new BigDecimal("10"));
        r.setIngredientsJson(objectMapper.writeValueAsString(List.of(Map.of("itemId", item.getId(), "quantity", "0.1"))));
        Recipe created = recipeService.createRecipe(r);
        TestAuth.as(userRepository, "manager");
        recipeService.updatePrice(created.getId(), new BigDecimal(price), "Test fiyat onayi");
        return created;
    }

    /** Kasiyer masa acar ve siparis girer; adisyon id'si doner */
    private Long openCheckWith(Recipe recipe, int qty, Recipe second, int qty2) {
        TestAuth.as(userRepository, "cashier");
        Long tableId = posService.createTable(TABLE_NO.incrementAndGet(), "Test", 4).getId();
        Long checkId = ((Number) posService.openCheck(tableId, 2).get("id")).longValue();
        List<PosService.ItemInput> items = second == null
                ? List.of(new PosService.ItemInput(recipe.getId(), qty, null))
                : List.of(new PosService.ItemInput(recipe.getId(), qty, null), new PosService.ItemInput(second.getId(), qty2, null));
        posService.addItems(checkId, items);
        return checkId;
    }

    private List<CheckItem> items(Long checkId) {
        return checkItemRepository.findByCheckIdOrderByIdAsc(checkId);
    }

    private JsonNode body(String json) throws Exception {
        return objectMapper.readTree(json).path("data");
    }

    @Test
    @DisplayName("Hazirlanan kalem: kasiyer dogrudan iptal edemez, talep acar; tahsilat bekler; Mudur onaylar ve kalem iptal olur")
    void itemVoidRequestApprovedByManager() throws Exception {
        InventoryItem meat = stockItem("Kiyma", "50", "300");
        Recipe kebap = approvedRecipe("Adana", "400", meat);
        Long checkId = openCheckWith(kebap, 2, null, 0);
        Long itemId = items(checkId).get(0).getId();

        TestAuth.as(userRepository, "chef");
        posService.updateItemStatus(itemId, "PREPARING");

        // Kasiyer hazirlanan kalemi dogrudan iptal edemez
        TestAuth.as(userRepository, "cashier");
        assertThrows(AccessDeniedException.class, () -> posService.cancelItem(itemId, "Musteri vazgecti"));

        // Talep acar (REST)
        String created = mvc.perform(post("/api/approvals").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ITEM_VOID\",\"targetId\":" + itemId + ",\"reason\":\"Musteri siparisten vazgecti\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.request.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long requestId = body(created).path("request").path("id").asLong();

        // Ayni kalem icin ikinci talep acilamaz
        mvc.perform(post("/api/approvals").header("Authorization", auth("cashier")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ITEM_VOID\",\"targetId\":" + itemId + ",\"reason\":\"Tekrar deneme talebi\"}"))
                .andExpect(status().is4xxClientError());

        // Bekleyen talep varken tahsilat yapilamaz
        TestAuth.as(userRepository, "cashier");
        assertThrows(BusinessRuleException.class, () -> posService.pay(checkId, "CASH", null));

        // Mudur bildirimi ve gelen kutusu
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> "APPROVAL_REQUEST".equals(n.getType())
                && n.getTargetRole().contains("MANAGER") && requestId == n.getRelatedEntityId()));
        mvc.perform(get("/api/approvals").param("scope", "inbox").param("status", "PENDING").header("Authorization", auth("manager")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + requestId + ")].canDecide").value(true));

        // Kasiyer ve Yonetici karar veremez; Mudur gerekcesiz reddedemez
        mvc.perform(put("/api/approvals/" + requestId + "/decide").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/approvals/" + requestId + "/decide").header("Authorization", auth("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/approvals/" + requestId + "/decide").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REJECT\",\"note\":\"\"}"))
                .andExpect(status().is4xxClientError());

        mvc.perform(put("/api/approvals/" + requestId + "/decide").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\",\"note\":\"Fire kaydi girilsin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        CheckItem after = checkItemRepository.findById(itemId).orElseThrow();
        assertEquals(CheckItem.CANCELLED, after.getStatus());
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> "APPROVAL_DECIDED".equals(n.getType())
                && n.getTargetRole().contains("CASHIER") && requestId == n.getRelatedEntityId()));

        // Sonuclanmis talebe ikinci karar verilemez
        mvc.perform(put("/api/approvals/" + requestId + "/decide").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REJECT\",\"note\":\"Gec kalan karar\"}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Ikram ve %10 indirim Mudur onayiyla uygulanir; tahsilatta ikram 0 TL, indirim satirlara dogru dagitilir")
    void compAndDiscountFlowIntoSales() throws Exception {
        InventoryItem meat = stockItem("Dana", "50", "250");
        Recipe main = approvedRecipe("Izgara", "300", meat);
        Recipe side = approvedRecipe("Salata", "125", meat);
        Long checkId = openCheckWith(main, 2, side, 1);
        List<CheckItem> lines = items(checkId);
        Long sideItemId = lines.get(1).getId();

        // Ikram talebi -> Mudur onayi
        TestAuth.as(userRepository, "cashier");
        Map<String, Object> comp = approvalService.request(new ApprovalService.RequestInput("COMP", sideItemId,
                "Bekleme suresi icin ozur ikrami", null, null, null));
        Long compId = ((Number) ((Map<?, ?>) comp.get("request")).get("id")).longValue();
        // Kasiyer kendi talebini onaylayamaz
        assertThrows(AccessDeniedException.class, () -> approvalService.decide(compId, true, null));
        TestAuth.as(userRepository, "manager");
        approvalService.decide(compId, true, "Uygun");
        CheckItem compItem = checkItemRepository.findById(sideItemId).orElseThrow();
        assertTrue(compItem.isComp());
        assertEquals(0, BigDecimal.ZERO.compareTo(compItem.getLineTotal()));

        // %10 indirim talebi -> Mudur onayi
        TestAuth.as(userRepository, "cashier");
        Map<String, Object> disc = approvalService.request(new ApprovalService.RequestInput("DISCOUNT", checkId,
                "Duzenli musteri indirimi", new BigDecimal("10"), null, null));
        Long discId = ((Number) ((Map<?, ?>) disc.get("request")).get("id")).longValue();
        TestAuth.as(userRepository, "manager");
        approvalService.decide(discId, true, null);

        Map<String, Object> detail = posService.checkDetail(checkId);
        assertEquals(0, new BigDecimal("600.00").compareTo((BigDecimal) detail.get("subtotal")));
        assertEquals(0, new BigDecimal("60.00").compareTo((BigDecimal) detail.get("discountAmount")));
        assertEquals(0, new BigDecimal("540.00").compareTo((BigDecimal) detail.get("total")));
        assertEquals(0, new BigDecimal("125.00").compareTo((BigDecimal) detail.get("compTotal")));

        // Tahsilat
        TestAuth.as(userRepository, "cashier");
        Map<String, Object> receipt = posService.pay(checkId, "CREDIT_CARD", null);
        assertEquals(0, new BigDecimal("540.00").compareTo((BigDecimal) receipt.get("total")));
        String checkNo = String.valueOf(receipt.get("checkNo"));
        List<SalesRecord> sales = salesRepository.findAll().stream().filter(s -> checkNo.equals(s.getOrderNo())).toList();
        assertEquals(2, sales.size());
        SalesRecord compSale = sales.stream().filter(s -> Boolean.TRUE.equals(s.getComp())).findFirst().orElseThrow();
        assertEquals(0, BigDecimal.ZERO.compareTo(compSale.getTotalPrice()));
        assertTrue(compSale.getTotalCost().signum() > 0, "Ikramin stok maliyeti kaydedilmeli");
        BigDecimal revenue = sales.stream().map(SalesRecord::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, new BigDecimal("540.00").compareTo(revenue));
    }

    @Test
    @DisplayName("Kasiyer indirim tutarini adisyonu asacak sekilde isteyemez; talebini geri cekebilir")
    void discountValidationAndWithdraw() throws Exception {
        InventoryItem meat = stockItem("Tavuk", "50", "120");
        Recipe r = approvedRecipe("Sis", "200", meat);
        Long checkId = openCheckWith(r, 1, null, 0);

        TestAuth.as(userRepository, "cashier");
        assertThrows(BusinessRuleException.class, () -> approvalService.request(new ApprovalService.RequestInput("DISCOUNT", checkId,
                "Asiri indirim denemesi", null, new BigDecimal("250"), null)));
        assertThrows(IllegalArgumentException.class, () -> approvalService.request(new ApprovalService.RequestInput("DISCOUNT", checkId,
                "Kisa", new BigDecimal("10"), null, null)));

        Map<String, Object> req = approvalService.request(new ApprovalService.RequestInput("DISCOUNT", checkId,
                "Dogum gunu indirimi", null, new BigDecimal("50"), null));
        Long id = ((Number) ((Map<?, ?>) req.get("request")).get("id")).longValue();
        approvalService.withdraw(id);
        assertEquals(ApprovalRequest.WITHDRAWN, approvalRepository.findById(id).orElseThrow().getStatus());
        // Geri cekilen talebe karar verilemez, tahsilat artik engellenmez
        TestAuth.as(userRepository, "manager");
        assertThrows(BusinessRuleException.class, () -> approvalService.decide(id, true, null));
        TestAuth.as(userRepository, "cashier");
        Map<String, Object> receipt = posService.pay(checkId, "CASH", new BigDecimal("500"));
        assertEquals(0, new BigDecimal("200.00").compareTo((BigDecimal) receipt.get("total")));
    }

    @Test
    @DisplayName("Mudur ikram ve indirimi dogrudan uygular; Kasiyer dogrudan uygulayamaz")
    void managerAppliesDirectlyCashierCannot() throws Exception {
        InventoryItem meat = stockItem("Kuzu", "50", "400");
        Recipe r = approvedRecipe("Tandir", "500", meat);
        Long checkId = openCheckWith(r, 1, null, 0);
        Long itemId = items(checkId).get(0).getId();

        mvc.perform(put("/api/pos/items/" + itemId + "/comp").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Kendi ikramim\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/pos/checks/" + checkId + "/discount").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"percent\":20,\"reason\":\"Kendi indirimim\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/pos/checks/" + checkId + "/discount").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":50,\"reason\":\"Isletme jesti\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountAmount").value(50.0))
                .andExpect(jsonPath("$.data.total").value(450.0));
        // Mudur talep acmaz, dogrudan uygular
        TestAuth.as(userRepository, "manager");
        assertThrows(BusinessRuleException.class, () -> approvalService.request(new ApprovalService.RequestInput("COMP", itemId,
                "Mudur talep denemesi", null, null, null)));
    }

    @Test
    @DisplayName("Depo: kucuk sayim farki dogrudan islenir, esigi asan fark Mudur onayina gider; ret stoku degistirmez")
    void stockCountApprovalThreshold() throws Exception {
        InventoryItem cheese = stockItem("Kasar", "20", "300");

        // 20 -> 19.5 kg: 150 TL fark (esik altinda) -> dogrudan
        mvc.perform(post("/api/inventory/" + cheese.getId() + "/adjust").header("Authorization", auth("warehouse"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"countedQuantity\":19.5,\"reason\":\"Haftalik sayim\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.approvalRequired").value(false));
        assertEquals(0, new BigDecimal("19.5").compareTo(itemRepository.findById(cheese.getId()).orElseThrow().getCurrentStock()));

        // 19.5 -> 15 kg: 1350 TL fark -> Mudur onayi
        String res = mvc.perform(post("/api/inventory/" + cheese.getId() + "/adjust").header("Authorization", auth("warehouse"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"countedQuantity\":15,\"reason\":\"Ay sonu sayimi\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.approvalRequired").value(true))
                .andReturn().getResponse().getContentAsString();
        long reqId = body(res).path("request").path("id").asLong();
        assertEquals(0, new BigDecimal("19.5").compareTo(itemRepository.findById(cheese.getId()).orElseThrow().getCurrentStock()),
                "Onay gelmeden stok degismemeli");

        // Depo dogrudan servis cagrisi ile de esigi asamaz
        TestAuth.as(userRepository, "warehouse");
        assertThrows(BusinessRuleException.class, () -> inventoryService.adjustToCount(cheese.getId(), new BigDecimal("15"), "Atlatma denemesi"));

        // Ret: stok degismez, depoya bildirim gider
        mvc.perform(put("/api/approvals/" + reqId + "/decide").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REJECT\",\"note\":\"Rafta 2 koli daha var, yeniden say\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
        assertEquals(0, new BigDecimal("19.5").compareTo(itemRepository.findById(cheese.getId()).orElseThrow().getCurrentStock()));
        assertTrue(notificationRepository.findAll().stream().anyMatch(n -> "APPROVAL_DECIDED".equals(n.getType())
                && n.getTargetRole().contains("WAREHOUSE") && reqId == n.getRelatedEntityId()));

        // Yeniden sayim -> onay -> fark uygulanir
        String res2 = mvc.perform(post("/api/inventory/" + cheese.getId() + "/adjust").header("Authorization", auth("warehouse"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"countedQuantity\":15.5,\"reason\":\"Yeniden sayim\"}"))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        long reqId2 = body(res2).path("request").path("id").asLong();
        mvc.perform(put("/api/approvals/" + reqId2 + "/decide").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        assertEquals(0, new BigDecimal("15.5").compareTo(itemRepository.findById(cheese.getId()).orElseThrow().getCurrentStock()));

        // Depo kendi taleplerini gorur; Mali Musavir gelen kutusu acamaz
        mvc.perform(get("/api/approvals").param("scope", "mine").header("Authorization", auth("warehouse")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/approvals").param("scope", "inbox").header("Authorization", auth("advisor")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/approvals/summary").header("Authorization", auth("manager")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canDecide").value(true));
    }

    @Test
    @DisplayName("Onaylanmadan adisyon kapanirsa talep gecersiz olur (EXPIRED)")
    void requestExpiresWhenCheckCancelled() throws Exception {
        InventoryItem meat = stockItem("Pirzola", "50", "350");
        Recipe r = approvedRecipe("Pirzola Tabak", "450", meat);
        Long checkId = openCheckWith(r, 1, null, 0);
        Long itemId = items(checkId).get(0).getId();
        TestAuth.as(userRepository, "cashier");
        Map<String, Object> req = approvalService.request(new ApprovalService.RequestInput("COMP", itemId,
                "Ozel gun ikrami talebi", null, null, null));
        Long id = ((Number) ((Map<?, ?>) req.get("request")).get("id")).longValue();
        // Hic hazirlanmamis adisyonu kasiyer dogrudan iptal eder -> bekleyen talep gecersiz olur
        posService.cancelCheck(checkId, "Musteri ayrildi");
        ApprovalRequest a = approvalRepository.findById(id).orElseThrow();
        assertEquals(ApprovalRequest.EXPIRED, a.getStatus());
        assertFalse(a.isPending());
    }
}
