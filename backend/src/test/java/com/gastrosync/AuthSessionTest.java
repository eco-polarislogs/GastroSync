package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.model.RefreshToken;
import com.gastrosync.repository.AuditLogRepository;
import com.gastrosync.repository.RefreshTokenRepository;

/**
 * Canli ortam oturum modeli: kisa omurlu erisim token'i + dondurulen yenileme token'i,
 * tekrar kullanim tespiti, cikis ve tum cihazlardan cikis.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AuthSessionTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private RefreshTokenRepository refreshRepository;
    @Autowired private AuditLogRepository auditLogRepository;

    private static final String PASSWORD = "123456";

    private JsonNode login(String username) throws Exception {
        String res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "JUnit Test Cihazi")
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).path("data");
    }

    private JsonNode refresh(String refreshToken, int expectedStatus) throws Exception {
        String res = mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).path("data");
    }

    @Test
    @DisplayName("Giris kisa omurlu erisim + yenileme token'i verir; yenileme token'i her kullanimda doner")
    void loginIssuesShortAccessAndRotatingRefresh() throws Exception {
        JsonNode s = login("chef");
        assertTrue(s.path("expiresIn").asLong() > 0 && s.path("expiresIn").asLong() <= 3600, "erisim token'i en fazla 1 saat");
        String r1 = s.path("refreshToken").asText();
        assertTrue(r1.length() >= 40);

        JsonNode s2 = refresh(r1, 200);
        String r2 = s2.path("refreshToken").asText();
        assertNotEquals(r1, r2);
        assertEquals("CHEF", s2.path("role").asText());
        assertTrue(s2.path("permissions").isArray());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + s2.path("token").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("chef"));
        // Gecersiz token
        refresh("uydurma-token-degeri-uydurma-token-degeri-12345", 401);
    }

    @Test
    @DisplayName("Kullanilmis yenileme token'i tolerans disinda tekrar gelirse tum cihaz oturumu iptal edilir")
    void reuseDetectionRevokesFamily() throws Exception {
        String r1 = login("warehouse").path("refreshToken").asText();
        String r2 = refresh(r1, 200).path("refreshToken").asText();

        // r1'in donduruldugu ani tolerans penceresinin disina tasi (calinti token senaryosu)
        RefreshToken old = refreshRepository.findAll().stream()
                .filter(t -> "warehouse".equals(t.getUsername()) && RefreshToken.ROTATED.equals(t.getRevokeReason()))
                .reduce((a, b) -> b).orElseThrow();
        old.setRevokedAt(LocalDateTime.now().minusMinutes(5));
        refreshRepository.save(old);

        refresh(r1, 401);
        // Ayni ailedeki gecerli token da artik gecersiz
        refresh(r2, 401);
        assertTrue(auditLogRepository.findAll().stream().anyMatch(a -> "REFRESH_TOKEN_REUSE".equals(a.getAction())));
    }

    @Test
    @DisplayName("Cikis bu cihazin yenileme token'ini iptal eder; diger cihaz etkilenmez")
    void logoutRevokesOnlyThisDevice() throws Exception {
        String phone = login("accountant").path("refreshToken").asText();
        String web = login("accountant").path("refreshToken").asText();
        mvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\"" + phone + "\"}"))
                .andExpect(status().isOk());
        refresh(phone, 401);
        refresh(web, 200);
        // Gecersiz token ile cikis bilgi sizdirmaz
        mvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\"yok\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Tum cihazlardan cikis: erisim ve yenileme token'lari hemen gecersiz olur")
    void logoutAllRevokesEverything() throws Exception {
        JsonNode a = login("advisor");
        JsonNode b = login("advisor");
        String access = a.path("token").asText();
        mvc.perform(get("/api/auth/sessions").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].device").value("JUnit Test Cihazi"));
        mvc.perform(post("/api/auth/logout-all").header("Authorization", "Bearer " + access)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + b.path("token").asText())).andExpect(status().isUnauthorized());
        refresh(a.path("refreshToken").asText(), 401);
        refresh(b.path("refreshToken").asText(), 401);
        // Yeniden giris calisir (bir sonraki saniyede)
        Thread.sleep(1100);
        JsonNode again = login("advisor");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + again.path("token").asText())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Yonetici personelin oturumlarini sonlandirabilir; diger roller sonlandiramaz")
    void adminRevokesStaffSessions() throws Exception {
        JsonNode cashier = login("cashier");
        JsonNode admin = login("admin");
        long cashierId = cashier.path("userId").asLong();
        mvc.perform(post("/api/users/" + cashierId + "/revoke-sessions").header("Authorization", "Bearer " + login("manager").path("token").asText()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/users/" + cashierId + "/revoke-sessions").header("Authorization", "Bearer " + admin.path("token").asText()))
                .andExpect(status().isOk());
        refresh(cashier.path("refreshToken").asText(), 401);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + cashier.path("token").asText())).andExpect(status().isUnauthorized());
        Thread.sleep(1100);
        login("cashier");
    }
}
