package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.access.AccessDeniedException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.service.SalesService;
import com.gastrosync.support.TestAuth;

/**
 * Stok maliyetlemesi, receteden stok dusumu, satis iptali ve kritik stok uyarisi.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
class SalesAndCogsIntegrationTest {

    @Autowired private InventoryService inventoryService;
    @Autowired private RecipeService recipeService;
    @Autowired private SalesService salesService;
    @Autowired private InventoryItemRepository itemRepository;
    @Autowired private StockTransactionRepository txRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private InventoryItem item(String name, String stock, String min, String cost) {
        InventoryItemRequest r = new InventoryItemRequest();
        r.setName(name + " " + System.nanoTime());
        r.setCategory("Test");
        r.setCurrentStock(new BigDecimal(stock));
        r.setMinStock(new BigDecimal(min));
        r.setUnit("kg");
        r.setUnitCost(new BigDecimal(cost));
        r.setSupplier("Test Tedarik");
        return inventoryService.createItem(r);
    }

    private Recipe recipe(String name, String price, InventoryItem item, String qty) throws Exception {
        Recipe r = new Recipe();
        r.setName(name + " " + System.nanoTime());
        r.setCategory("Test");
        r.setSalePrice(new BigDecimal(price));
        r.setPortions(1);
        r.setVatRate(new BigDecimal("10"));
        r.setIngredientsJson(objectMapper.writeValueAsString(List.of(Map.of("itemId", item.getId(), "quantity", qty))));
        return recipeService.createRecipe(r);
    }

    @Test
    @DisplayName("Agirlikli ortalama maliyet: 10kg@100 + 10kg@200 = 150 TL/kg")
    void weightedAverageCost() {
        TestAuth.as(userRepository, "warehouse");
        InventoryItem it = item("Ortalama", "10", "1", "100.00");
        inventoryService.receiveStock(it.getId(), new BigDecimal("10"), new BigDecimal("200.00"), "FTR-1", null);
        InventoryItem after = itemRepository.findById(it.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("150.00").compareTo(after.getUnitCost()));
        assertEquals(0, new BigDecimal("20").compareTo(after.getCurrentStock()));
    }

    @Test
    @DisplayName("Fire stoktan fazla olamaz; sayim farki ADJUSTMENT olarak kaydedilir")
    void wasteAndAdjustment() {
        TestAuth.as(userRepository, "warehouse");
        InventoryItem it = item("Fire", "5", "1", "40.00");
        assertThrows(BusinessRuleException.class, () -> inventoryService.recordWaste(it.getId(), new BigDecimal("6"), "Bozulma", null));
        assertThrows(IllegalArgumentException.class, () -> inventoryService.recordWaste(it.getId(), new BigDecimal("1"), "", null));
        inventoryService.recordWaste(it.getId(), new BigDecimal("1"), "Son kullanma tarihi gecti", null);

        StockTransaction adj = inventoryService.adjustToCount(it.getId(), new BigDecimal("3.5"), "Ay sonu sayimi");
        assertEquals(StockTransaction.ADJUSTMENT, adj.getType());
        assertEquals(0, new BigDecimal("-0.5").compareTo(adj.getQuantity()));
        assertEquals(0, new BigDecimal("3.5").compareTo(adj.getBalanceAfter()));
    }

    @Test
    @DisplayName("Depo sorumlusu birim maliyeti degistiremez")
    void warehouseCannotChangeCost() {
        TestAuth.as(userRepository, "warehouse");
        InventoryItem it = item("Maliyet", "5", "1", "40.00");
        InventoryItemRequest upd = new InventoryItemRequest();
        upd.setName(it.getName());
        upd.setCategory("Test");
        upd.setUnit("kg");
        upd.setMinStock(BigDecimal.ONE);
        upd.setUnitCost(new BigDecimal("1.00"));
        assertThrows(AccessDeniedException.class, () -> inventoryService.updateItem(it.getId(), upd));
    }

    @Test
    @DisplayName("Satis: fiyat receteden, stok dusumu, maliyet ve KDV dondurulur; istemci fiyati yok sayilir")
    void saleUsesServerSidePricing() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItem meat = item("Antrikot", "20", "2", "450.00");
        Recipe steak = recipe("Izgara", "550.00", meat, "0.25");

        TestAuth.as(userRepository, "accountant");
        SalesRecord tampered = new SalesRecord(null, null, steak.getName(), 4, new BigDecimal("1.00"), new BigDecimal("4.00"), "Masa 3", "Nakit");
        SalesRecord sale = salesService.recordSale(tampered);

        assertEquals(0, new BigDecimal("2200.00").compareTo(sale.getTotalPrice()));
        assertEquals("CASH", sale.getPaymentMethod());
        assertEquals(0, new BigDecimal("450.00").compareTo(sale.getTotalCost())); // 4 x 0.25kg x 450
        assertEquals(0, new BigDecimal("200.00").compareTo(sale.getVatAmount())); // 2200 x 10/110
        InventoryItem after = itemRepository.findById(meat.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("19").compareTo(after.getCurrentStock()));
        assertEquals(1, txRepository.findByReferenceTypeAndReferenceIdAndType("SALE", sale.getId(), StockTransaction.OUTBOUND_SALE).size());
    }

    @Test
    @DisplayName("Yetersiz stokta siparis atomik olarak reddedilir")
    void insufficientStockIsAtomic() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItem a = item("BolStok", "50", "1", "10.00");
        InventoryItem b = item("AzStok", "0.1", "0", "10.00");
        Recipe ra = recipe("Bol", "100.00", a, "1");
        Recipe rb = recipe("Az", "100.00", b, "1");
        assertThrows(BusinessRuleException.class, () -> salesService.recordOrder("Masa 1", "CASH", null, List.of(
                new SalesService.OrderLine(ra.getId(), null, 1),
                new SalesService.OrderLine(rb.getId(), null, 1))));
        assertEquals(0, new BigDecimal("50").compareTo(itemRepository.findById(a.getId()).orElseThrow().getCurrentStock()));
    }

    @Test
    @DisplayName("Menude olmayan urun satilamaz")
    void unknownProductRejected() {
        TestAuth.as(userRepository, "accountant");
        SalesRecord s = new SalesRecord(null, null, "Menude Olmayan Yemek", 1, BigDecimal.TEN, BigDecimal.TEN, "Masa 1", "CASH");
        assertThrows(IllegalArgumentException.class, () -> salesService.recordSale(s));
    }

    @Test
    @DisplayName("Satis iptali stogu ters kayitla iade eder; net SMM sifirlanir")
    void voidRestoresStock() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItem it = item("Iptal", "10", "1", "100.00");
        Recipe r = recipe("IptalYemek", "300.00", it, "0.5");
        SalesRecord sale = salesService.recordOrder("Masa 5", "CREDIT_CARD", null, List.of(new SalesService.OrderLine(r.getId(), null, 2))).get(0);
        assertEquals(0, new BigDecimal("9").compareTo(itemRepository.findById(it.getId()).orElseThrow().getCurrentStock()));

        assertThrows(IllegalArgumentException.class, () -> salesService.voidSale(sale.getId(), ""));
        SalesRecord voided = salesService.voidSale(sale.getId(), "Musteri siparisi iptal etti");
        assertEquals(SalesRecord.STATUS_VOIDED, voided.getStatus());
        assertEquals(0, new BigDecimal("10").compareTo(itemRepository.findById(it.getId()).orElseThrow().getCurrentStock()));
        assertEquals(1, txRepository.findByReferenceTypeAndReferenceIdAndType("SALE", sale.getId(), StockTransaction.SALE_REVERSAL).size());
        assertThrows(BusinessRuleException.class, () -> salesService.voidSale(sale.getId(), "Ikinci iptal denemesi"));
    }

    @Test
    @DisplayName("Kritik seviyeye inen stok icin depo/mutfak/yonetim bildirimi uretilir")
    void lowStockNotification() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItem it = item("Kritik", "3", "2", "10.00");
        Recipe r = recipe("KritikYemek", "50.00", it, "1");
        salesService.recordOrder("Masa 1", "CASH", null, List.of(new SalesService.OrderLine(r.getId(), null, 1)));
        assertTrue(notificationRepository.findAll().stream()
                .anyMatch(n -> "INVENTORY_LOW".equals(n.getType()) && it.getId().equals(n.getRelatedEntityId())
                        && n.getTargetRole().contains("WAREHOUSE")));
    }

    @Test
    @DisplayName("Sef menu fiyatini degistiremez, gramaji degistirebilir")
    void chefCannotChangePrice() throws Exception {
        TestAuth.as(userRepository, "manager");
        InventoryItem it = item("SefFiyat", "10", "1", "10.00");
        Recipe r = recipe("SefYemek", "100.00", it, "0.2");

        TestAuth.as(userRepository, "chef");
        Recipe priceChange = new Recipe();
        priceChange.setSalePrice(new BigDecimal("50.00"));
        assertThrows(AccessDeniedException.class, () -> recipeService.updateRecipe(r.getId(), priceChange));

        Recipe gramaj = new Recipe();
        gramaj.setIngredientsJson(objectMapper.writeValueAsString(List.of(Map.of("itemId", it.getId(), "quantity", "0.3"))));
        Recipe updated = recipeService.updateRecipe(r.getId(), gramaj);
        assertEquals(0, new BigDecimal("3.00").compareTo(updated.getPortionCost()));
    }
}
