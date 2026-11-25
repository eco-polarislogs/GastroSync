package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.DeviceTokenRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.NotificationService;
import com.gastrosync.service.push.PushGateway;
import com.gastrosync.support.TestAuth;

/**
 * Telefon bildirimi: uygulama ici bildirim merkezine dusen bildirim, yalnizca hedef roldeki kullanicilarin
 * kayitli cihazlarina gonderilir; gecersizlesen cihaz adresi silinir; cikista cihaz kaydi kaldirilir.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PushNotificationTest {

    static final List<PushGateway.PushMessage> SENT = new CopyOnWriteArrayList<>();
    static final List<String> DEAD = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class CapturingGatewayConfig {
        @Bean
        @Primary
        PushGateway capturingGateway() {
            return messages -> {
                SENT.addAll(messages);
                return messages.stream().map(PushGateway.PushMessage::to).filter(DEAD::contains).toList();
            };
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JwtTokenProvider jwt;
    @Autowired private NotificationService notificationService;
    @Autowired private DeviceTokenRepository deviceRepository;

    private String auth(String username) {
        return TestAuth.bearer(userRepository, jwt, username);
    }

    private void register(String user, String token) throws Exception {
        mvc.perform(post("/api/notifications/devices").header("Authorization", auth(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"platform\":\"android\"}"))
                .andExpect(status().isOk());
    }

    private boolean waitFor(java.util.function.BooleanSupplier cond) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            if (cond.getAsBoolean()) return true;
            Thread.sleep(100);
        }
        return cond.getAsBoolean();
    }

    @Test
    @DisplayName("Bildirim yalnizca hedef rolun telefonlarina gider; gecersiz adres silinir; cikista kayit kalkar")
    void pushFollowsTargetRoles() throws Exception {
        String cashierToken = "ExponentPushToken[kasiyerTestCihazi001]";
        String chefToken = "ExponentPushToken[sefTestCihazi0000002]";
        register("cashier", cashierToken);
        register("chef", chefToken);
        // Gecersiz bicim reddedilir
        mvc.perform(post("/api/notifications/devices").header("Authorization", auth("cashier")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"rastgele-metin\"}"))
                .andExpect(status().isBadRequest());

        SENT.clear();
        notificationService.notify(List.of("CASHIER"), "Talebiniz onaylandi", "Masa 5 iptal talebi onaylandi", "Mudur",
                "APPROVAL_DECIDED", 1L, "/pos", "INFO");
        assertTrue(waitFor(() -> SENT.stream().anyMatch(m -> m.to().equals(cashierToken))), "Kasiyerin telefonuna gitmeli");
        assertFalse(SENT.stream().anyMatch(m -> m.to().equals(chefToken)), "Sefin telefonuna gitmemeli");
        assertTrue(SENT.stream().filter(m -> m.to().equals(cashierToken)).allMatch(m -> "/pos".equals(m.data().get("route"))));

        // Push servisi cihazi gecersiz bildirirse kayit silinir
        DEAD.add(chefToken);
        SENT.clear();
        notificationService.notify(List.of("CHEF"), "Yeni siparis", "Masa 3: 2 x Adana", "Kasiyer", "GENERAL", null, "/kitchen", "INFO");
        assertTrue(waitFor(() -> deviceRepository.findByToken(chefToken).isEmpty()), "Gecersiz cihaz adresi silinmeli");

        // Cikista kasiyer kendi cihaz kaydini kaldirir
        mvc.perform(post("/api/notifications/devices/unregister").header("Authorization", auth("cashier")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + cashierToken + "\"}"))
                .andExpect(status().isOk());
        assertTrue(deviceRepository.findByToken(cashierToken).isEmpty());
    }
}
