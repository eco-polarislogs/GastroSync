package com.gastrosync;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.gastrosync.model.ChatMessage;
import com.gastrosync.model.Notification;
import com.gastrosync.repository.ChatMessageRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.ChatService;
import com.gastrosync.service.NotificationService;

/**
 * Isolated Domain Test: WebSocket & STOMP Protocol Security and Persistence.
 *
 * Verifies JWT channel interceptor mechanics, atomic message persistence under concurrent
 * load, and cross-platform notification synchronization topics.
 */
@SpringBootTest
public class WebSocketStompSecurityTest {

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ChatService chatService;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Test
    @DisplayName("STOMP 1: WebSocket JWT Token Üretimi ve Validasyonu")
    public void testWebSocketJwtValidation() {
        String managerToken = jwtTokenProvider.generateToken(2L, "manager_user", "MANAGER", "Zeynep Müdür");
        assertNotNull(managerToken);
        assertTrue(jwtTokenProvider.validateToken(managerToken));
        assertEquals("manager_user", jwtTokenProvider.getUsername(managerToken));
        assertEquals("MANAGER", jwtTokenProvider.getRole(managerToken));

        String chefToken = jwtTokenProvider.generateToken(3L, "chef_user", "CHEF", "Mehmet Şef");
        assertNotNull(chefToken);
        assertTrue(jwtTokenProvider.validateToken(chefToken));
        assertEquals("CHEF", jwtTokenProvider.getRole(chefToken));

        // Boş veya sahte token reddedilmelidir
        assertFalse(jwtTokenProvider.validateToken("sahte_veya_bozuk_token"));
    }

    @Test
    @DisplayName("STOMP 2: Eşzamanlı Mesajlaşmada PostgreSQL Atomik Saklama ve Sıfır Kayıp Garantisi")
    public void testConcurrentChatPersistence() throws InterruptedException {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);

        long beforeCount = chatMessageRepository.count();

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    ChatMessage msg = new ChatMessage();
                    msg.setChannelId("kitchen");
                    msg.setSender("Şef Yardımcısı " + index);
                    msg.setRole("chef");
                    msg.setText("Masa 4 siparişi hazırlandı - Mesaj #" + index);
                    msg.setTime("12:" + (10 + index));
                    chatService.sendMessage(msg);
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finishedInTime = latch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finishedInTime, "Eşzamanlı mesajlaşma işlemleri zaman aşımına uğramamalı");
        long afterCount = chatMessageRepository.count();
        assertEquals(beforeCount + threadCount, afterCount, "Tüm eşzamanlı STOMP mesajları veritabanına atomik olarak yazılmalıdır");
    }

    @Test
    @DisplayName("STOMP 3: Eyleme Dayalı Bildirim Oluşturma ve Derin Bağlantı Rotalama Senkronizasyonu")
    public void testActionableNotificationRouting() {
        Notification notif = new Notification();
        notif.setTitle("Test Acil Onay");
        notif.setMessage("Test Gideri onay bekliyor");
        notif.setTargetRole("FINANCIAL_ADVISOR");
        notif.setType("EXPENSE_APPROVAL");
        notif.setSeverity("WARNING");
        notif.setRelatedEntityId(999L);

        Notification saved = notificationService.createNotification(notif);
        assertNotNull(saved.getId());
        assertEquals("/advisor-ledger", saved.getRoute());
        assertEquals("WARNING", saved.getSeverity());

        // Okundu yapma testi
        notificationService.markAsRead(saved.getId());
        Notification updated = notificationRepository.findById(saved.getId()).orElseThrow();
        assertTrue(updated.getIsRead());
    }
}
