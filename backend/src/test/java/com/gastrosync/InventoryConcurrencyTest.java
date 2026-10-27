package com.gastrosync;

import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.gastrosync.model.InventoryItem;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.service.InventoryService;

/**
 * Isolated Domain Test: High-Concurrency & Row-Level Locking (ACID Integrity).
 *
 * Hammers PostgreSQL with concurrent parallel threads simulating warehouse receipts
 * and cashier adjustments simultaneously, proving zero lost updates under heavy load.
 */
@SpringBootTest
public class InventoryConcurrencyTest {

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Test
    @DisplayName("ACID 1: Paralel Thread'lerle Eşzamanlı Mal Kabulünde Sıfır Kayıp Güncelleme (Zero Lost Updates)")
    public void testConcurrentStockIncrements() throws InterruptedException {
        // 1. Test Hammaddesi Başlat (Başlangıç: 100.00 kg Un)
        String uniqueId = String.valueOf(System.currentTimeMillis() % 1000000);
        InventoryItem un = new InventoryItem(
                "Böreklik Un " + uniqueId,
                "Kuru Gıda",
                new BigDecimal("100.00"),
                new BigDecimal("20.00"),
                "kg",
                new BigDecimal("18.50"),
                "Un Değirmeni",
                "UN-" + uniqueId,
                "Bugün"
        );
        un = inventoryItemRepository.save(un);

        final Long itemId = un.getId();
        int threadCount = 10;
        BigDecimal addAmountPerThread = new BigDecimal("10.00"); // 10 thread * 10 kg = +100 kg, Toplam = 200 kg

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        // 2. 10 Farklı Paralel Operatör Eşzamanlı Mal Kabul Yapıyor
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    inventoryService.receiveStock(itemId, addAmountPerThread, "Depo Operatörü");
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    // Log error if any
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finishedInTime = latch.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finishedInTime, "Eşzamanlı stok işlemleri zaman aşımına uğramamalı");
        assertEquals(threadCount, successCount.get(), "Tüm eşzamanlı thread'ler başarıyla işlenmeli");

        // 3. Nihai Bakiye Doğrulaması (100 + 10 * 10 = 200.00 kg)
        InventoryItem finalItem = inventoryItemRepository.findById(itemId).orElseThrow();
        assertEquals(0, new BigDecimal("200.00").compareTo(finalItem.getCurrentStock()),
                "PostgreSQL satır kilidi sayesinde eşzamanlı işlemlerde kayıp güncelleme (lost update) oluşmamalıdır");
    }
}
