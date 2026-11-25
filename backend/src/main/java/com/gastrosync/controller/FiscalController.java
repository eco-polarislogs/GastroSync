package com.gastrosync.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.FiscalDocument;
import com.gastrosync.service.FiscalService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/fiscal")
@Tag(name = "Mali Belge", description = "e-Arsiv fatura, OKC fis baglama ve mali belge mutabakati")
public class FiscalController {

    private final FiscalService fiscalService;

    public FiscalController(FiscalService fiscalService) {
        this.fiscalService = fiscalService;
    }

    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> status() {
        return ResponseEntity.ok(ApiResponse.ok("Mali belge yapilandirmasi", fiscalService.status()));
    }

    @PostMapping("/checks/{id}/e-arsiv")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Odenmis adisyon icin e-Arsiv fatura (alici bos ise Nihai Tuketici)")
    public ResponseEntity<ApiResponse<FiscalDocument>> eArsiv(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        FiscalDocument d = fiscalService.issueEArsiv(id, s(b.get("buyerName")), s(b.get("buyerTaxId")), s(b.get("buyerTaxOffice")), s(b.get("buyerEmail")));
        return ResponseEntity.ok(ApiResponse.ok(FiscalDocument.ACCEPTED.equals(d.getStatus())
                ? "e-Arsiv fatura duzenlendi" : "e-Arsiv fatura taslagi olusturuldu (entegrator tanimli degil)", d));
    }

    @PostMapping("/checks/{id}/okc")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Yazar kasada (OKC) kesilen fis numarasini adisyona bagla")
    public ResponseEntity<ApiResponse<FiscalDocument>> okc(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("OKC fisi adisyona baglandi",
                fiscalService.recordOkc(id, s(body.get("receiptNo")), s(body.get("zNo")))));
    }

    @GetMapping("/checks/{id}")
    @PreAuthorize("@perm.can('POS_VIEW', 'SALES_VIEW')")
    public ResponseEntity<ApiResponse<List<FiscalDocument>>> forCheck(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyonun mali belgeleri", fiscalService.forCheck(id)));
    }

    @GetMapping("/summary")
    @PreAuthorize("@perm.can('SALES_VIEW', 'CASH_CLOSING_VIEW')")
    @Operation(summary = "Gunun mali belge mutabakati: belgesiz adisyonlar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary(@RequestParam(name = "date", required = false) String date) {
        LocalDate day = date == null || date.isBlank() ? LocalDate.now() : LocalDate.parse(date);
        return ResponseEntity.ok(ApiResponse.ok("Mali belge ozeti", fiscalService.daySummary(day)));
    }

    @GetMapping(value = "/documents/{id}/xml")
    @PreAuthorize("@perm.can('POS_VIEW', 'SALES_VIEW')")
    public ResponseEntity<byte[]> xml(@PathVariable("id") Long id) {
        FiscalDocument d = fiscalService.get(id);
        if (d.getXml() == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + d.getDocumentNo() + ".xml\"")
                .contentType(MediaType.APPLICATION_XML)
                .body(d.getXml().getBytes(StandardCharsets.UTF_8));
    }

    @PutMapping("/documents/{id}/cancel")
    @PreAuthorize("@perm.can('POS_CANCEL_APPROVE', 'EXPENSE_SUBMIT')")
    public ResponseEntity<ApiResponse<FiscalDocument>> cancel(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Belge iptal edildi", fiscalService.cancel(id, s(body.get("reason")))));
    }

    private static String s(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
