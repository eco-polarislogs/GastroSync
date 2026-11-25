package com.gastrosync;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.CashClosing;
import com.gastrosync.model.Recipe;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.service.PosService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.service.ReportService;
import com.gastrosync.support.TestAuth;

/**
 * Roller arasi gonderme / onaylama / reddetme akislari ve yoneticinin kaydettigi personelin
 * yalnizca kendi rolunun ekranlarina girebilmesi.
 */
@SpringBootTest
// IDE / test çalıştırıcısı surefire profilini atlasa da gerçek veritabanına asla yazılmaz (izole H2)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class RoleWorkflowTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private JwtTokenProvider jwt;
    @Autowired private ReportService reportService;
    @Autowired private RecipeService recipeService;
    @Autowired private PosService posService;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private String auth(String username) {
        return TestAuth.bearer(userRepository, jwt, username);
    }

    @Test
    @DisplayName("Yoneticinin kaydettigi kasiyer, verilen bilgilerle girer ve yalnizca kendi ekranlarini / izinlerini alir")
    void adminRegisteredStaffLogsInWithGivenRole() throws Exception {
        String username = "kasa" + (System.nanoTime() % 1000000);
        mvc.perform(post("/api/users").header("Authorization", auth("admin")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Yeni Kasiyer\",\"username\":\"" + username + "\",\"email\":\"" + username
                                + "@restoran.com\",\"role\":\"CASHIER\",\"password\":\"Kasa2026x\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("CASHIER"));

        // Kullanici adi veya e-posta ile giris
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "@restoran.com\",\"password\":\"Kasa2026x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("CASHIER"))
                .andExpect(jsonPath("$.data.name").value("Yeni Kasiyer"))
                .andExpect(jsonPath("$.data.screens[0]").value("pos"))
                .andExpect(jsonPath("$.data.permissions", hasItem("POS_OPERATE")))
                .andExpect(jsonPath("$.data.permissions", not(hasItem("EXPENSE_VIEW"))))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        String token = "Bearer " + node.path("data").path("token").asText();

        mvc.perform(get("/api/auth/me").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.screens.length()").value(1));
        mvc.perform(get("/api/pos/tables").header("Authorization", token)).andExpect(status().isOk());
        // Diger rollerin ekranlari kapali
        for (String url : List.of("/api/expenses/search", "/api/inventory", "/api/recipes", "/api/users", "/api/sales/search",
                "/api/audit-logs", "/api/reports/summary", "/api/pos/kitchen")) {
            mvc.perform(get(url).header("Authorization", token)).andExpect(status().isForbidden());
        }

        // Ayni kullanici adi / e-posta ikinci kez verilemez
        mvc.perform(post("/api/users").header("Authorization", auth("admin")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Kopya\",\"username\":\"baska" + username + "\",\"email\":\"" + username
                                + "@restoran.com\",\"role\":\"CHEF\",\"password\":\"Kasa2026x\"}"))
                .andExpect(status().isConflict());
        // Personel listesi yalnizca Yonetici; arama ve siralama
        mvc.perform(get("/api/users/search?role=CASHIER&sort=name,desc&size=5").header("Authorization", auth("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].role").value("CASHIER"))
                .andExpect(jsonPath("$.data.meta.roleCounts.CASHIER").isNumber());
        mvc.perform(get("/api/users").header("Authorization", auth("manager"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/roles").header("Authorization", auth("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(7));
    }

    @Test
    @DisplayName("Kasiyer gun sonu sayar; Muhasebe mutabakat yapar veya gerekceyle yeniden sayim ister")
    void cashierCountsAccountantReconciles() throws Exception {
        TestAuth.as(userRepository, "cashier");
        CashClosing c = reportService.createCashClosing(null, new BigDecimal("500"), new BigDecimal("500"), "Gun sonu sayimi");
        assertEquals(CashClosing.PENDING_REVIEW, c.getStatus());
        // Kasiyer kendi sayimini onaylayamaz; Mudur ve Mali Musavir mutabakat yapamaz
        assertThrows(AccessDeniedException.class, () -> reportService.reviewCashClosing(c.getId(), true, null));
        for (String u : new String[]{"cashier", "manager", "advisor", "admin"}) {
            mvc.perform(put("/api/reports/cash-closings/" + c.getId() + "/review").header("Authorization", auth(u))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                    .andExpect(status().isForbidden());
        }
        // Muhasebe sayim giremez
        mvc.perform(post("/api/reports/cash-closings").header("Authorization", auth("accountant"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"countedCash\":100,\"note\":\"deneme sayim\"}"))
                .andExpect(status().isForbidden());
        TestAuth.as(userRepository, "accountant");
        assertThrows(IllegalArgumentException.class, () -> reportService.reviewCashClosing(c.getId(), false, "kisa"));
        CashClosing rejected = reportService.reviewCashClosing(c.getId(), false, "POS slip toplami Z ozetiyle tutmuyor");
        assertEquals(CashClosing.REJECTED, rejected.getStatus());
        assertThrows(BusinessRuleException.class, () -> reportService.reviewCashClosing(c.getId(), true, null));

        TestAuth.as(userRepository, "cashier");
        CashClosing again = reportService.createCashClosing(null, new BigDecimal("500"), new BigDecimal("500"), "Yeniden sayim");
        TestAuth.as(userRepository, "accountant");
        assertEquals(CashClosing.RECONCILED, reportService.reviewCashClosing(again.getId(), true, "Mutabik").getStatus());

        // Gunluk / aylik / yillik kasa raporu (Muhasebe), kasiyer goremez
        for (String g : new String[]{"day", "month", "year"}) {
            mvc.perform(get("/api/reports/cash-report?granularity=" + g).header("Authorization", auth("accountant")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.rows").isArray())
                    .andExpect(jsonPath("$.data.totals.grossSales").isNumber());
        }
        mvc.perform(get("/api/reports/cash-report").header("Authorization", auth("cashier"))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Sefin yeni recetesi Mudur fiyat onayina kadar kasada satisa acilmaz")
    void chefRecipeNeedsManagerPriceApproval() throws Exception {
        TestAuth.as(userRepository, "chef");
        Recipe input = new Recipe();
        input.setName("Onay Bekleyen Corba " + System.nanoTime());
        input.setCategory("Corba");
        input.setSalePrice(new BigDecimal("150"));
        input.setPortions(1);
        input.setIngredientsJson("[]");
        Recipe created = recipeService.createRecipe(input);
        assertFalse(created.getPriceApproved());
        // Sef fiyat belirleyemez
        assertThrows(AccessDeniedException.class, () -> recipeService.updatePrice(created.getId(), new BigDecimal("160"), "deneme"));

        TestAuth.as(userRepository, "cashier");
        List<Map<String, Object>> menu = posService.menu();
        assertTrue(menu.stream().noneMatch(m -> created.getId().equals(m.get("id"))), "Onaysiz recete menude olmamali");

        // Mudur ayni fiyati onaylayabilir (fiyat degismese de onay gecerlidir)
        mvc.perform(put("/api/recipes/" + created.getId() + "/price").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"salePrice\":150,\"reason\":\"Fiyat uygun\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.priceApproved").value(true));
        assertTrue(recipeRepository.findById(created.getId()).orElseThrow().getPriceApproved());
        // Yonetici menu fiyati belirleyemez
        mvc.perform(put("/api/recipes/" + created.getId() + "/price").header("Authorization", auth("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"salePrice\":170,\"reason\":\"Yonetici denemesi\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Masa ve mutfak: kasiyer siparis alir, sef hazirlar; roller birbirinin adimini yapamaz")
    void posAndKitchenSeparation() throws Exception {
        mvc.perform(get("/api/pos/kitchen").header("Authorization", auth("chef"))).andExpect(status().isOk());
        mvc.perform(get("/api/pos/kitchen").header("Authorization", auth("accountant"))).andExpect(status().isForbidden());
        // Masa duzeni isletmeye gore degisir: Kasiyer, Mudur ve Yonetici masa ekleyebilir
        int tableNo = 991;
        for (String u : new String[]{"cashier", "manager", "admin"}) {
            mvc.perform(post("/api/pos/tables").header("Authorization", auth(u)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"number\":" + tableNo++ + ",\"area\":\"Bahce\",\"capacity\":4}"))
                    .andExpect(status().isCreated());
        }
        // Ayni numara ikinci kez tanimlanamaz
        mvc.perform(post("/api/pos/tables").header("Authorization", auth("cashier")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":991,\"area\":\"Salon\",\"capacity\":2}"))
                .andExpect(status().is4xxClientError());
        // Muhasebe, Sef ve Mali Musavir masa ekleyemez
        for (String u : new String[]{"accountant", "chef", "advisor"}) {
            mvc.perform(post("/api/pos/tables").header("Authorization", auth(u)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"number\":995,\"area\":\"Bahce\",\"capacity\":4}"))
                    .andExpect(status().isForbidden());
        }
        // Yonetici masa ekler ama siparis / tahsilat yapamaz
        mvc.perform(post("/api/pos/tables/1/open").header("Authorization", auth("admin")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestCount\":2}"))
                .andExpect(status().isForbidden());
        // Muhasebe satis giremez (POS kasiyerin isidir); Yonetici de giremez
        for (String u : new String[]{"accountant", "admin", "manager"}) {
            mvc.perform(post("/api/sales/order").header("Authorization", auth(u)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"tableNo\":\"1\",\"paymentMethod\":\"CASH\",\"items\":[{\"recipeId\":1,\"quantity\":1}]}"))
                    .andExpect(status().isForbidden());
        }
        // Sef adisyon acamaz / tahsilat alamaz
        mvc.perform(post("/api/pos/checks/1/pay").header("Authorization", auth("chef")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CASH\"}"))
                .andExpect(status().isForbidden());
    }
}
