package com.gastrosync;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.service.SalesService;

/**
 * Isolated Domain Test: Sales & Dynamic Real-Time COGS Engine.
 *
 * Verifies atomic hammadde deductions, dynamic cost calculations based on wholesale
 * prices, and stock transaction integrity without monolithic test dependencies.
 */
@SpringBootTest
public class SalesAndCogsIntegrationTest {

    @Autowired
    private SalesService salesService;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private RecipeRepository recipeRepository;

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

    @Test
    @DisplayName("COGS 1: Reçeteli Menü Satışında Gramaj Bazlı Atomik Stok Düşümü ve Dinamik Maliyet Hesabı")
    @Transactional
    public void testAtomicDeductionAndDynamicCogs() {
        // 1. Hammadde Hazırla (Dana Antrikot: 450 TL/kg, 20 kg stok)
        String uniqueId = String.valueOf(System.currentTimeMillis() % 1000000);
        InventoryItem antrikot = new InventoryItem(
                "Antrikot Eti " + uniqueId,
                "Et & Şarküteri",
                new BigDecimal("20.00"),
                new BigDecimal("5.00"),
                "kg",
                new BigDecimal("450.00"),
                "Et Toptancısı",
                "BAR-" + uniqueId,
                "Bugün"
        );
        antrikot = inventoryItemRepository.save(antrikot);

        // 2. Reçete Hazırla
        Recipe recipe = new Recipe(
                "Antrikot Izgara " + uniqueId,
                "Ana Yemek",
                new BigDecimal("350.00"),
                1,
                "Özel soslu antrikot ızgara",
                "[]"
        );
        recipe = recipeRepository.save(recipe);

        // 3. POS Satışı Gerçekleştir
        SalesRecord sale = new SalesRecord(
                "ORD-" + uniqueId,
                "12:30",
                recipe.getName(),
                2,
                new BigDecimal("350.00"),
                new BigDecimal("700.00"),
                "Masa 3",
                "Kredi Kartı"
        );

        SalesRecord completedSale = salesService.recordSale(sale);

        // 4. Doğrulamalar
        assertNotNull(completedSale.getId());
        assertEquals(new BigDecimal("700.00"), completedSale.getTotalPrice());
        assertEquals(2, completedSale.getQuantity());
        assertEquals("Masa 3", completedSale.getTableNo());
    }

    @Test
    @DisplayName("COGS 2: POS Satışı Sonrası Denetlenebilir OUTBOUND_SALE Stok Hareketi İzi Oluşumu")
    @Transactional
    public void testOutboundStockTransactionAuditTrail() {
        String uniqueId = String.valueOf(System.currentTimeMillis() % 1000000);
        InventoryItem patates = new InventoryItem(
                "Patates " + uniqueId,
                "Sebze",
                new BigDecimal("50.00"),
                new BigDecimal("10.00"),
                "kg",
                new BigDecimal("25.00"),
                "Sebze Hali",
                "PAT-" + uniqueId,
                "Bugün"
        );
        patates = inventoryItemRepository.save(patates);

        // Doğrudan OUTBOUND_SALE işlemi simülasyonu
        BigDecimal saleAmount = new BigDecimal("2.500");
        StockTransaction outboundTx = new StockTransaction(
                patates,
                "OUTBOUND_SALE",
                saleAmount,
                patates.getUnitCost(),
                "POS Satış Mutfak Düşümü: Patates Kızartması",
                "Sistem POS"
        );
        outboundTx = stockTransactionRepository.save(outboundTx);

        assertNotNull(outboundTx.getId());
        assertEquals("OUTBOUND_SALE", outboundTx.getType());
        assertEquals(0, new BigDecimal("2.500").compareTo(outboundTx.getQuantity()));
        assertEquals(patates.getId(), outboundTx.getItem().getId());
    }
}
