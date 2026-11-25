package com.gastrosync;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.PageResponse;
import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.support.TestAuth;

/**
 * Sayfalama, demo hesap listesi ve yonetici tarafindan olusturulan / rolu degistirilen
 * kullanicinin verilen bilgilerle dogrudan ilgili ekranlara erisebilmesi.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PaginationAndAccountFlowTest {

    @Autowired private MockMvc mvc;
    @Autowired private ExpenseService expenseService;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JwtTokenProvider jwt;
    @Autowired private ObjectMapper objectMapper;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    @Test
    @DisplayName("Gider listesi sayfalanir; sekme sayaclari ve arama calisir")
    void expensePagination() {
        TestAuth.as(userRepository, "accountant");
        String tag = "SAYFA" + System.nanoTime();
        for (int i = 0; i < 7; i++) {
            ExpenseCreateRequest r = new ExpenseCreateRequest();
            r.setTitle(tag + " gider " + i);
            r.setCategory("VARIABLE");
            r.setSubType("CONSUMABLES");
            r.setAmount(new BigDecimal("10.00"));
            r.setExpenseDate(LocalDate.now());
            expenseService.createExpense(r);
        }
        PageResponse<ExpenseResponse> p0 = expenseService.search(null, "pending", tag, 0, 5);
        PageResponse<ExpenseResponse> p1 = expenseService.search(null, "pending", tag, 1, 5);
        assertEquals(7, p0.totalElements());
        assertEquals(2, p0.totalPages());
        assertEquals(5, p0.content().size());
        assertEquals(2, p1.content().size());
        assertTrue(((Number) ((java.util.Map<?, ?>) p0.meta().get("counts")).get("pending")).longValue() >= 7);
    }

    @Test
    @DisplayName("Demo modunda calisan demo hesaplari listelenir ve giris yapilabilir")
    void demoAccounts() throws Exception {
        mvc.perform(get("/api/auth/demo-accounts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.accounts[*].username", hasItem("accountant")))
                .andExpect(jsonPath("$.data.accounts[*].username", hasItem("advisor")));
    }

    @Test
    @DisplayName("Yonetici yeni personel ekler; personel verilen kullanici adi/e-posta ve sifreyle dogrudan girer")
    void adminCreatedUserCanLoginImmediately() throws Exception {
        String admin = TestAuth.bearer(userRepository, jwt, "admin");
        String username = "kasiyer" + (System.nanoTime() % 100000);
        mvc.perform(post("/api/users").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yeni Kasiyer\",\"username\":\"" + username + "\",\"email\":\"" + username
                                + "@restoran.test\",\"role\":\"ACCOUNTANT\",\"password\":\"Kasa2026\"}"))
                .andExpect(status().isCreated());

        // e-posta ile giris -> sifre degistirme zorunlu degil -> kasa ekrani verilerine erisir
        String json = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "@restoran.test\",\"password\":\"Kasa2026\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("ACCOUNTANT"))
                .andExpect(jsonPath("$.data.mustChangePassword").value(false))
                .andReturn().getResponse().getContentAsString();
        String token = "Bearer " + objectMapper.readTree(json).at("/data/token").asText();
        mvc.perform(get("/api/expenses/search?tab=pending").header("Authorization", token)).andExpect(status().isOk());

        // Yonetici rolu Mali Musavir yapar -> ayni oturum aninda yeni role gecer
        Long id = userRepository.findByUsernameIgnoreCase(username).orElseThrow().getId();
        mvc.perform(put("/api/users/" + id + "/role").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"FINANCIAL_ADVISOR\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", token))
                .andExpect(jsonPath("$.data.role").value("FINANCIAL_ADVISOR"));
        mvc.perform(get("/api/reports/journal").header("Authorization", token)).andExpect(status().isOk());

        // Ad / e-posta duzeltme
        mvc.perform(put("/api/users/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yeni Musavir\",\"email\":\"musavir." + username + "@restoran.test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Yeni Musavir"));
    }

    @Test
    @DisplayName("Yonetici isterse yeni personelden ilk giriste sifre degistirmesi istenir")
    void optionalPasswordChange() throws Exception {
        String admin = TestAuth.bearer(userRepository, jwt, "admin");
        String username = "sef" + (System.nanoTime() % 100000);
        mvc.perform(post("/api/users").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yeni Sef\",\"username\":\"" + username
                                + "\",\"role\":\"CHEF\",\"password\":\"Gecici2026\",\"requirePasswordChange\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.mustChangePassword").value(true));
    }

    @Test
    @DisplayName("Satis ve denetim izi sayfali doner")
    void otherPagedEndpoints() throws Exception {
        String manager = TestAuth.bearer(userRepository, jwt, "manager");
        mvc.perform(get("/api/sales/search?page=0&size=5").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(5))
                .andExpect(jsonPath("$.data.totalElements", greaterThanOrEqualTo(0)));
        mvc.perform(get("/api/sales/range-summary").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.products").isArray());
        // Denetim izi: Yonetici ve Mali Musavir; Mudur goremez
        mvc.perform(get("/api/audit-logs?page=0&size=10&sort=actor,asc").header("Authorization", TestAuth.bearer(userRepository, jwt, "admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
        mvc.perform(get("/api/audit-logs?page=0&size=10").header("Authorization", manager))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/sales/search?page=0&size=5&sort=totalPrice,desc").header("Authorization", manager))
                .andExpect(status().isOk());
        mvc.perform(get("/api/inventory/transactions?page=0&size=10&type=INBOUND").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }
}
