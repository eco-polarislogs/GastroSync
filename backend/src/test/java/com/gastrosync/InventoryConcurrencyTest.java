package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.service.InventoryService;
import com.gastrosync.support.TestAuth;

@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
class InventoryConcurrencyTest {

    @Autowired private InventoryService inventoryService;
    @Autowired private InventoryItemRepository itemRepository;
    @Autowired private AppUserRepository userRepository;

    @Test
    @DisplayName("Es zamanli mal kabullerde kayip guncelleme olmaz (satir kilidi)")
    void concurrentReceives() throws Exception {
        TestAuth.as(userRepository, "warehouse");
        InventoryItemRequest r = new InventoryItemRequest();
        r.setName("Eszamanli Un " + System.nanoTime());
        r.setCategory("Test");
        r.setCurrentStock(new BigDecimal("100"));
        r.setMinStock(BigDecimal.ONE);
        r.setUnit("kg");
        r.setUnitCost(new BigDecimal("20.00"));
        InventoryItem item = inventoryService.createItem(r);
        TestAuth.clear();

        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger failures = new AtomicInteger();
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    TestAuth.as(userRepository, "warehouse");
                    start.await();
                    inventoryService.receiveStock(item.getId(), new BigDecimal("10"), null, null, null);
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    TestAuth.clear();
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertTrue(done.await(60, TimeUnit.SECONDS));
        pool.shutdown();

        assertEquals(0, failures.get());
        InventoryItem after = itemRepository.findById(item.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("180").compareTo(after.getCurrentStock()));
    }
}
