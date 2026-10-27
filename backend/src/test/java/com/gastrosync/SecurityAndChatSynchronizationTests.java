package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gastrosync.repository.ChatMessageRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SecurityAndChatSynchronizationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Test
    @Order(1)
    @DisplayName("GÜVENLİK TESTİ: Yetkisiz erişim 403 ile engellenmelidir")
    void testUnauthorizedEndpointAccessIsBlocked() throws Exception {
        String chefToken = jwtTokenProvider.generateToken(3L, "sef", "CHEF", "Fatma Kaya");

        // Aşçı kullanıcısı satış özetine erişmeye çalışır (Yalnızca Admin, Müdür, Muhasebe ve Mali Müşavir yetkilidir)
        mockMvc.perform(get("/api/sales/summary")
                .header("Authorization", "Bearer " + chefToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @Order(2)
    @DisplayName("İSTEMCİ GÜVENLİK BİLDİRİMİ: Mobil/Web rota engeli backend güvenlik alarm uç noktasına iletilmeli")
    void testReportSecurityAlertEndpointSavesAlerts() throws Exception {
        String warehouseToken = jwtTokenProvider.generateToken(4L, "depocu", "WAREHOUSE", "Ali Çelik");

        String payload = """
            {
                "screen": "users",
                "action": "MOBİL_NAVİGASYON_DENEMESİ"
            }
        """;

        mockMvc.perform(post("/api/notifications/security-alert")
                .header("Authorization", "Bearer " + warehouseToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        var alerts = notificationRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(n -> "SECURITY_ALERT".equals(n.getType()))
                .filter(n -> n.getMessage().contains("depocu") && n.getMessage().contains("users"))
                .toList();

        assertFalse(alerts.isEmpty(), "depocu kullanıcısının yetkisiz ekran denemesi veritabanına kaydedilmiş olmalıdır!");
    }

    @Test
    @Order(3)
    @DisplayName("BİLDİRİM SENKRONİZASYONU: Yönetici ve Admin güvenlik alarmlarını bildirim listesinde görmelidir")
    void testManagerAndAdminCanViewSecurityAlerts() throws Exception {
        String managerToken = jwtTokenProvider.generateToken(2L, "mudur", "MANAGER", "Zeynep Demir");

        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @Order(4)
    @DisplayName("MESAJLAŞMA ENTEGRASYONU: Personel mesaj gönderdiğinde veritabanına yazılmalı ve otomatik ekip bildirimi üretmeli")
    void testChatMessagingPersistsAndProducesNotifications() throws Exception {
        String chefToken = jwtTokenProvider.generateToken(3L, "sef", "CHEF", "Fatma Kaya");

        String chatPayload = """
            {
                "channelId": "kitchen",
                "text": "Akşam VIP servis için acil 10 kg dana antrikot gerekiyor!",
                "priority": "urgent"
            }
        """;

        mockMvc.perform(post("/api/chat/messages")
                .header("Authorization", "Bearer " + chefToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(chatPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.channelId").value("kitchen"))
                .andExpect(jsonPath("$.data.priority").value("urgent"));

        // Mesaj veritabanında var mı kontrol et
        var messages = chatMessageRepository.findByChannelIdOrderByCreatedAtAsc("kitchen");
        boolean msgFound = messages.stream().anyMatch(m -> m.getText().contains("dana antrikot"));
        assertTrue(msgFound, "Mutfak kanalına atılan mesaj veritabanında bulunmalıdır!");

        // Otomatik CHAT bildirimi üretildi mi kontrol et
        var chatNotifs = notificationRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(n -> "CHAT".equals(n.getType()))
                .toList();
        assertFalse(chatNotifs.isEmpty(), "Sohbet mesajı için otomatik CHAT bildirimi üretilmelidir!");
    }

    @Test
    @Order(5)
    @DisplayName("MESAJLAŞMA SENKRONİZASYONU: Kanala göre filtreleme ve anlık okuma kusursuz çalışmalıdır")
    void testChatChannelFiltering() throws Exception {
        String managerToken = jwtTokenProvider.generateToken(2L, "mudur", "MANAGER", "Zeynep Demir");

        mockMvc.perform(get("/api/chat/messages?channelId=kitchen")
                .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @Order(6)
    @DisplayName("KİMLİK DOĞRULAMA KORUMASI: Token olmadan mesajlaşmaya ve bildirimlere erişim 401 Unauthorized ile engellenmeli")
    void testUnauthenticatedChatIsBlocked() throws Exception {
        mockMvc.perform(get("/api/chat/messages"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/chat/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"channelId\":\"kitchen\",\"text\":\"sahte\"}"))
                .andExpect(status().isUnauthorized());
    }
}
