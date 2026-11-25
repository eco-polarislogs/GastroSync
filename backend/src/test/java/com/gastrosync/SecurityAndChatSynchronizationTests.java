package com.gastrosync;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.in;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.model.AppUser;
import com.gastrosync.model.Notification;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.AuditLogRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.support.TestAuth;

/**
 * HTTP seviyesinde yetkilendirme, oturum guvenligi, bildirim kapsami ve sohbet kanal izinleri.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class SecurityAndChatSynchronizationTests {

    @Autowired private MockMvc mvc;
    @Autowired private JwtTokenProvider jwt;
    @Autowired private AppUserRepository userRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    private String auth(String username) {
        return TestAuth.bearer(userRepository, jwt, username);
    }

    private AppUser tempUser(String role) {
        AppUser u = new AppUser("tmp" + System.nanoTime(), passwordEncoder.encode("Gecici2026"), "Gecici Personel", role, null);
        return userRepository.save(u);
    }

    @Test
    @DisplayName("Giris: dogru bilgilerle token doner, yanlis sifre 400")
    void login() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"manager\",\"password\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.role").value("MANAGER"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"manager\",\"password\":\"yanlis-sifre\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Kaba kuvvet korumasi: 5 hatali denemeden sonra 429")
    void bruteForceLockout() throws Exception {
        String body = "{\"username\":\"brute-force-hedef\",\"password\":\"yanlis1\"}";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Token olmadan korumali uclara erisim 401")
    void unauthenticatedBlocked() throws Exception {
        mvc.perform(get("/api/chat/messages")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/expenses")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/inventory").header("Authorization", "Bearer sahte.token.degeri")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Yetkisiz erisim 403 ve yoneticilere guvenlik bildirimi + denetim kaydi")
    void forbiddenCreatesAlert() throws Exception {
        long auditBefore = auditLogRepository.count();
        mvc.perform(get("/api/sales/summary").header("Authorization", auth("warehouse")))
                .andExpect(status().isForbidden());
        assertTrue(auditLogRepository.count() > auditBefore);
        assertTrue(notificationRepository.findAll().stream()
                .anyMatch(n -> "SECURITY_ALERT".equals(n.getType()) && n.getTargetRole().contains("ADMIN")));
    }

    @Test
    @DisplayName("Rol matrisi: yalnizca mali musavir deftere isler; yonetici ve muhasebe isleyemez")
    void onlyAdvisorFinalizes() throws Exception {
        mvc.perform(put("/api/expenses/999999/finalize").header("Authorization", auth("admin")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/expenses/999999/finalize").header("Authorization", auth("accountant")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/expenses/999999/finalize").header("Authorization", auth("advisor")))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/sales").header("Authorization", auth("chef")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productName\":\"Pizza Margherita\",\"quantity\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/users").header("Authorization", auth("accountant")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Rol degisikligi mevcut token'a ANINDA yansir")
    void roleChangeTakesEffectImmediately() throws Exception {
        AppUser u = tempUser("CHEF");
        String token = "Bearer " + jwt.generateToken(u.getId(), u.getUsername(), "CHEF", u.getName());
        mvc.perform(get("/api/recipes").header("Authorization", token)).andExpect(status().isOk());

        mvc.perform(put("/api/users/" + u.getId() + "/role").header("Authorization", auth("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"WAREHOUSE\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/recipes").header("Authorization", token)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Pasife alinan hesabin token'i gecersiz olur")
    void deactivatedUserLosesAccess() throws Exception {
        AppUser u = tempUser("WAREHOUSE");
        String token = "Bearer " + jwt.generateToken(u.getId(), u.getUsername(), "WAREHOUSE", u.getName());
        mvc.perform(get("/api/inventory").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(put("/api/users/" + u.getId() + "/status").header("Authorization", auth("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/inventory").header("Authorization", token)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Ilk giriste sifre degistirme zorunlu; degisiklik sonrasi eski token gecersiz")
    void mustChangePasswordFlow() throws Exception {
        AppUser u = tempUser("CHEF");
        u.setMustChangePassword(true);
        userRepository.save(u);
        String loginBody = "{\"username\":\"" + u.getUsername() + "\",\"password\":\"Gecici2026\"}";
        String loginJson = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mustChangePassword").value(true))
                .andReturn().getResponse().getContentAsString();
        String oldToken = "Bearer " + objectMapper.readTree(loginJson).at("/data/token").asText();

        mvc.perform(get("/api/inventory").header("Authorization", oldToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
        mvc.perform(get("/api/auth/me").header("Authorization", oldToken)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/change-password").header("Authorization", oldToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Gecici2026\",\"newPassword\":\"123\"}"))
                .andExpect(status().isBadRequest());

        Thread.sleep(1100);
        String changed = mvc.perform(post("/api/auth/change-password").header("Authorization", oldToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Gecici2026\",\"newPassword\":\"YeniSifre2026\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String newToken = "Bearer " + objectMapper.readTree(changed).at("/data/token").asText();

        mvc.perform(get("/api/inventory").header("Authorization", newToken)).andExpect(status().isOk());
        mvc.perform(get("/api/inventory").header("Authorization", oldToken)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Son aktif yonetici silinemez / rolu dusurulemez; kullanici kendini silemez")
    void lastAdminProtected() throws Exception {
        AppUser admin = userRepository.findByUsernameIgnoreCase("admin").orElseThrow();
        mvc.perform(put("/api/users/" + admin.getId() + "/role").header("Authorization", auth("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"CHEF\"}"))
                .andExpect(status().isConflict());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/users/" + admin.getId())
                        .header("Authorization", auth("admin")))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Bildirim kapsami: sef baska rolun bildirimlerini goremez ve okundu yapamaz (IDOR)")
    void notificationScope() throws Exception {
        Notification secret = notificationRepository.save(new Notification("Musavir Ozel", "Gizli", "FINANCIAL_ADVISOR",
                "Test", "EXPENSE_APPROVAL", null, "EXPENSE_DETAIL", "/advisor-ledger", "INFO"));

        String json = mvc.perform(get("/api/notifications?role=FINANCIAL_ADVISOR").header("Authorization", auth("chef")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(json).get("data");
        for (JsonNode n : data) {
            String target = n.get("targetRole").asText();
            assertTrue(target.equals("ALL") || List.of(target.split(",")).contains("CHEF"), "Sef'e sizan bildirim: " + target);
        }
        mvc.perform(put("/api/notifications/" + secret.getId() + "/read").header("Authorization", auth("chef")))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/notifications/" + secret.getId() + "/read").header("Authorization", auth("advisor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isRead").value(true));
        // Okundu bilgisi kullaniciya ozeldir: yonetici icin hala okunmamis
        String mgr = mvc.perform(get("/api/notifications").header("Authorization", auth("manager")))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode n : objectMapper.readTree(mgr).get("data")) {
            if (n.get("id").asLong() == secret.getId()) {
                assertTrue(!n.get("isRead").asBoolean());
            }
        }
    }

    @Test
    @DisplayName("Duyuru olusturma yalnizca ADMIN/MANAGER; sef sahte guvenlik bildirimi uretemez")
    void announcementsRestricted() throws Exception {
        mvc.perform(post("/api/notifications").header("Authorization", auth("chef")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Sahte\",\"message\":\"x\",\"targetRole\":\"ALL\",\"type\":\"SECURITY_ALERT\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/notifications").header("Authorization", auth("manager")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Personel toplantisi\",\"message\":\"Saat 15:00\",\"targetRole\":\"ALL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("ANNOUNCEMENT"));
    }

    @Test
    @DisplayName("Sohbet: kanal izinleri uygulanir ve gonderen kimligi sunucuda belirlenir")
    void chatChannelAclAndIdentity() throws Exception {
        mvc.perform(get("/api/chat/messages?channelId=cashier").header("Authorization", auth("warehouse")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/chat/messages").header("Authorization", auth("warehouse")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channelId\":\"management\",\"text\":\"merhaba\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/chat/messages").header("Authorization", auth("chef")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channelId\":\"kitchen\",\"text\":\"Domates bitti\",\"sender\":\"Sahte Mudur\",\"role\":\"admin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sender").value("Mehmet Sef"))
                .andExpect(jsonPath("$.data.role").value("chef"));

        String all = mvc.perform(get("/api/chat/messages").header("Authorization", auth("warehouse")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].channelId", everyItem(in(List.of("general", "shift", "kitchen", "warehouse")))))
                .andReturn().getResponse().getContentAsString();
        assertTrue(all.contains("data"));
    }

    @Test
    @DisplayName("Saglik kontrolu kimlik dogrulamasiz erisilebilir")
    void health() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
