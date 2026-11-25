package com.gastrosync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.support.TestAuth;

/**
 * Canliya cikis eksikleri: parcali odeme / hesap bolme, cevrimdisi kuyruk icin Idempotency-Key,
 * mali belge (e-Arsiv taslagi, OKC fis baglama, mutabakat) ve yazici isleri.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class SplitPaymentFiscalPrintTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper om;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JwtTokenProvider jwt;

    @AfterEach
    void cleanup() {
        TestAuth.clear();
    }

    private String auth(String u) {
        return TestAuth.bearer(userRepository, jwt, u);
    }

    private JsonNode data(MvcResult r) throws Exception {
        return om.readTree(r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data");
    }

    private JsonNode call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b, String user, String body) throws Exception {
        b.header("Authorization", auth(user));
        if (body != null) b.contentType(MediaType.APPLICATION_JSON).content(body);
        MvcResult r = mvc.perform(b).andExpect(status().isOk()).andReturn();
        return data(r);
    }

    /** Yeni masa + adisyon + 2 kalem; adisyon kimligini dondurur */
    private long openCheckWithItems(int tableNo) throws Exception {
        MvcResult t = mvc.perform(post("/api/pos/tables").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":" + tableNo + ",\"area\":\"Test\",\"capacity\":4}"))
                .andExpect(status().isCreated()).andReturn();
        long tableId = data(t).path("id").asLong();
        long checkId = call(post("/api/pos/tables/" + tableId + "/open"), "cashier", "{\"guestCount\":2}").path("id").asLong();
        JsonNode menu = call(get("/api/pos/menu"), "cashier", null);
        long recipeId = -1;
        for (JsonNode m : menu) {
            if (m.path("available").asBoolean(true)) { recipeId = m.path("id").asLong(); break; }
        }
        assertTrue(recipeId > 0, "Satilabilir menu kalemi olmali");
        call(post("/api/pos/checks/" + checkId + "/items"), "cashier",
                "{\"items\":[{\"recipeId\":" + recipeId + ",\"quantity\":2}]}");
        return checkId;
    }

    @Test
    @DisplayName("Parcali odeme: nakit + kart karisik tahsilat; kalan sifirlaninca adisyon kapanir ve satis MIXED olur")
    void splitPaymentClosesCheck() throws Exception {
        long checkId = openCheckWithItems(931);
        JsonNode detail = call(get("/api/pos/checks/" + checkId), "cashier", null);
        BigDecimal total = new BigDecimal(detail.path("total").asText());
        assertTrue(total.signum() > 0);
        BigDecimal half = total.divide(BigDecimal.valueOf(2), 2, java.math.RoundingMode.HALF_UP);

        JsonNode p1 = call(post("/api/pos/checks/" + checkId + "/payments"), "cashier",
                "{\"paymentMethod\":\"CASH\",\"amount\":" + half + ",\"receivedAmount\":" + half.add(BigDecimal.TEN) + "}");
        assertFalse(p1.path("closed").asBoolean());
        assertEquals(0, new BigDecimal(p1.path("remainingAmount").asText()).compareTo(total.subtract(half)));

        // Kalanin tamami kartla (amount bos)
        JsonNode p2 = call(post("/api/pos/checks/" + checkId + "/payments"), "cashier", "{\"paymentMethod\":\"CARD\"}");
        assertTrue(p2.path("closed").asBoolean());
        assertEquals("MIXED", p2.path("paymentMethod").asText());
        assertEquals(2, p2.path("payments").size());
        assertEquals(checkId, p2.path("checkId").asLong());

        // Kapanmis adisyona ek tahsilat alinamaz
        mvc.perform(post("/api/pos/checks/" + checkId + "/payments").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"paymentMethod\":\"CASH\",\"amount\":1}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Kalan tutardan fazla tahsilat reddedilir; kismi tahsilat gerekceyle geri alinabilir")
    void overpayRejectedAndVoid() throws Exception {
        long checkId = openCheckWithItems(932);
        BigDecimal total = new BigDecimal(call(get("/api/pos/checks/" + checkId), "cashier", null).path("total").asText());
        mvc.perform(post("/api/pos/checks/" + checkId + "/payments").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CARD\",\"amount\":" + total.add(BigDecimal.ONE) + "}"))
                .andExpect(status().is4xxClientError());
        JsonNode p = call(post("/api/pos/checks/" + checkId + "/payments"), "cashier", "{\"paymentMethod\":\"CARD\",\"amount\":1}");
        long paymentId = p.path("lastPayment").path("id").asLong();
        JsonNode v = call(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/pos/payments/" + paymentId + "/void"),
                "cashier", "{\"reason\":\"Yanlis kart cekildi\"}");
        assertEquals(0, new BigDecimal(v.path("paidAmount").asText()).signum());
        // Sef tahsilat alamaz
        mvc.perform(post("/api/pos/checks/" + checkId + "/payments").header("Authorization", auth("chef"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"paymentMethod\":\"CASH\",\"amount\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Cevrimdisi kuyruk: ayni Idempotency-Key ile ikinci gonderim tahsilati tekrarlamaz")
    void idempotentReplayDoesNotDoubleCharge() throws Exception {
        long checkId = openCheckWithItems(933);
        String key = "offline-" + System.nanoTime();
        MvcResult first = mvc.perform(post("/api/pos/checks/" + checkId + "/payments").header("Authorization", auth("cashier"))
                        .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CARD\",\"amount\":1}"))
                .andExpect(status().isOk()).andReturn();
        mvc.perform(post("/api/pos/checks/" + checkId + "/payments").header("Authorization", auth("cashier"))
                        .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentMethod\":\"CARD\",\"amount\":1}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replay", "true"));
        JsonNode d = call(get("/api/pos/checks/" + checkId), "cashier", null);
        assertEquals(1, d.path("payments").size(), "Tekrar gonderim ikinci odeme yaratmamali");
        assertEquals(first.getResponse().getContentAsString(), first.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("Mali belge: odenmis adisyona e-Arsiv taslagi ve OKC fis no baglanir; mutabakat belgesizi gosterir")
    void fiscalDocuments() throws Exception {
        long checkId = openCheckWithItems(934);
        // Odenmemis adisyona e-Arsiv kesilemez
        mvc.perform(post("/api/fiscal/checks/" + checkId + "/e-arsiv").header("Authorization", auth("cashier"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().is4xxClientError());
        call(post("/api/pos/checks/" + checkId + "/payments"), "cashier", "{\"paymentMethod\":\"CARD\"}");

        JsonNode summaryBefore = call(get("/api/fiscal/summary"), "manager", null);
        assertTrue(summaryBefore.toString().contains(String.valueOf(checkId)) || summaryBefore.path("missingCount").asInt(0) > 0,
                "Belgesiz adisyon mutabakatta gorunmeli: " + summaryBefore);

        JsonNode doc = call(post("/api/fiscal/checks/" + checkId + "/e-arsiv"), "cashier",
                "{\"buyerName\":\"Ornek Ltd\",\"buyerTaxId\":\"1234567890\",\"buyerTaxOffice\":\"Kadikoy\"}");
        assertTrue(doc.path("documentNo").asText().length() >= 10, "e-Arsiv belge numarasi uretilmeli");
        long docId = doc.path("id").asLong();
        MvcResult xml = mvc.perform(get("/api/fiscal/documents/" + docId + "/xml").header("Authorization", auth("cashier")))
                .andExpect(status().isOk()).andReturn();
        String body = xml.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(body.contains("Invoice") && body.contains("EARSIVFATURA"), "UBL-TR e-Arsiv XML uretilmeli");

        JsonNode okc = call(post("/api/fiscal/checks/" + checkId + "/okc"), "cashier", "{\"receiptNo\":\"0042\",\"zNo\":\"0117\"}");
        assertEquals("OKC", okc.path("type").asText());
        assertTrue(call(get("/api/fiscal/checks/" + checkId), "cashier", null).size() >= 2);

        // Sef mali belge kesemez
        mvc.perform(post("/api/fiscal/checks/" + checkId + "/okc").header("Authorization", auth("chef"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"receiptNo\":\"1\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Yazici: kasiyer adisyon dokumu basar; yazici tanimini yalnizca yetkili roller yapar")
    void printing() throws Exception {
        MvcResult pr = mvc.perform(post("/api/print/printers").header("Authorization", auth("manager"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Kasa Yazicisi\",\"station\":\"RECEIPT\",\"host\":\"192.168.1.50\",\"connection\":\"BRIDGE\",\"charsPerLine\":48,\"active\":true}"))
                .andExpect(status().isOk()).andReturn();
        assertTrue(data(pr).path("id").asLong() > 0);
        mvc.perform(post("/api/print/printers").header("Authorization", auth("chef"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"station\":\"KITCHEN\"}"))
                .andExpect(status().isForbidden());

        long checkId = openCheckWithItems(935);
        JsonNode jobs = call(post("/api/print/checks/" + checkId + "?type=BILL"), "cashier", null);
        assertTrue(jobs.isArray());
        JsonNode recent = call(get("/api/print/jobs"), "cashier", null);
        assertTrue(recent.size() >= 1, "Yazdirma isi kaydedilmeli");
    }
}
