package com.gastrosync.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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
import com.gastrosync.dto.PageResponse;
import com.gastrosync.model.AccountingPeriod;
import com.gastrosync.model.AuditLog;
import com.gastrosync.model.CashClosing;
import com.gastrosync.service.AccountingPeriodService;
import com.gastrosync.service.AuditService;
import com.gastrosync.service.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api")
@Tag(name = "Mali Raporlar & Donem", description = "Kar/zarar, KDV, yevmiye, Z raporu, kasa sayimi, donem kapanisi, denetim izi")
public class ReportController {

    private final ReportService reportService;
    private final AccountingPeriodService periodService;
    private final AuditService auditService;

    public ReportController(ReportService reportService, AccountingPeriodService periodService, AuditService auditService) {
        this.reportService = reportService;
        this.periodService = periodService;
        this.auditService = auditService;
    }

    @GetMapping("/reports/summary")
    @PreAuthorize("@perm.can('FINANCE_SUMMARY_VIEW')")
    @Operation(summary = "Donem kar/zarar ozeti (YYYY-MM, varsayilan icinde bulunulan ay)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary(@RequestParam(name = "period", required = false) String period) {
        return ResponseEntity.ok(ApiResponse.ok("Donem ozeti", reportService.periodSummary(period)));
    }

    @GetMapping("/reports/vat")
    @PreAuthorize("@perm.can('VAT_REPORT_VIEW')")
    @Operation(summary = "KDV on izleme (hesaplanan - indirilecek)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> vat(@RequestParam(name = "period", required = false) String period) {
        return ResponseEntity.ok(ApiResponse.ok("KDV ozeti", reportService.vatReport(period)));
    }

    @GetMapping("/reports/journal")
    @PreAuthorize("@perm.can('JOURNAL_VIEW')")
    @Operation(summary = "TDHP yevmiye fis dokumu (taslak)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> journal(@RequestParam(name = "period", required = false) String period) {
        return ResponseEntity.ok(ApiResponse.ok("Yevmiye fis dokumu", reportService.journal(period)));
    }

    @GetMapping("/reports/z-report")
    @PreAuthorize("@perm.can('ZREPORT_VIEW')")
    @Operation(summary = "Gun sonu Z ozeti (gercek satislardan)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> zReport(
            @RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok("Z raporu", reportService.zReport(date)));
    }

    @GetMapping("/reports/cash-closings")
    @PreAuthorize("@perm.can('CASH_CLOSING_VIEW')")
    public ResponseEntity<ApiResponse<List<CashClosing>>> cashClosings(
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok("Kasa sayimlari", reportService.cashClosings(from, to)));
    }

    @PostMapping("/reports/cash-closings")
    @PreAuthorize("@perm.can('CASH_CLOSING_CREATE')")
    @Operation(summary = "Gun sonu kor kasa sayimi (her zaman kaydedilir; fark aciklamasi sonradan eklenir)")
    public ResponseEntity<ApiResponse<CashClosing>> createCashClosing(@RequestBody Map<String, Object> body) {
        LocalDate date = body.get("date") != null && !body.get("date").toString().isBlank()
                ? LocalDate.parse(body.get("date").toString()) : LocalDate.now();
        BigDecimal opening = body.get("openingFloat") != null && !body.get("openingFloat").toString().isBlank()
                ? InventoryController.decimal(body.get("openingFloat"), "openingFloat") : BigDecimal.ZERO;
        BigDecimal counted = InventoryController.decimal(body.get("countedCash"), "countedCash");
        String note = body.get("note") != null ? body.get("note").toString() : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Kasa sayimi kaydedildi", reportService.createCashClosing(date, opening, counted, note)));
    }

    @PutMapping("/reports/cash-closings/{id}/explanation")
    @PreAuthorize("@perm.can('CASH_CLOSING_CREATE')")
    @Operation(summary = "Kasa farki aciklamasi (yalnizca sayimi giren, mutabakat oncesi)")
    public ResponseEntity<ApiResponse<CashClosing>> explainCashClosing(@PathVariable("id") Long id,
                                                                      @RequestBody Map<String, Object> body) {
        String text = body.get("explanation") != null ? body.get("explanation").toString() : null;
        return ResponseEntity.ok(ApiResponse.ok("Aciklama eklendi", reportService.addCashClosingExplanation(id, text)));
    }

    @PutMapping("/reports/cash-closings/{id}/review")
    @PreAuthorize("@perm.can('CASH_CLOSING_REVIEW')")
    @Operation(summary = "Kasa sayimi mutabakati: APPROVE veya REJECT (gerekce zorunlu)")
    public ResponseEntity<ApiResponse<CashClosing>> reviewCashClosing(@PathVariable("id") Long id,
                                                                     @RequestBody Map<String, Object> body) {
        String decision = body.get("decision") == null ? "" : body.get("decision").toString().trim().toUpperCase(java.util.Locale.ROOT);
        if (!decision.equals("APPROVE") && !decision.equals("REJECT")) {
            throw new IllegalArgumentException("decision APPROVE veya REJECT olmalidir");
        }
        String note = body.get("note") != null ? body.get("note").toString() : null;
        return ResponseEntity.ok(ApiResponse.ok(decision.equals("APPROVE") ? "Kasa sayimi onaylandi" : "Yeniden sayim istendi",
                reportService.reviewCashClosing(id, decision.equals("APPROVE"), note)));
    }

    @GetMapping("/reports/cash-report")
    @PreAuthorize("@perm.can('CASH_REPORT_VIEW')")
    @Operation(summary = "Gunluk (ay), aylik (yil) veya yillik kasa ve gelir raporu")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cashReport(
            @RequestParam(name = "granularity", required = false) String granularity,
            @RequestParam(name = "period", required = false) String period) {
        return ResponseEntity.ok(ApiResponse.ok("Kasa raporu", reportService.cashReport(granularity, period)));
    }

    // ── Muhasebe donemleri ─────────────────────────────────────

    @GetMapping("/accounting/periods")
    @PreAuthorize("@perm.can('PERIOD_VIEW')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> periods() {
        return ResponseEntity.ok(ApiResponse.ok("Muhasebe donemleri", periodService.list()));
    }

    @PostMapping("/accounting/periods/{period}/close")
    @PreAuthorize("@perm.can('PERIOD_MANAGE')")
    @Operation(summary = "Donemi kapat (Mali Musavir veya Yonetici)")
    public ResponseEntity<ApiResponse<AccountingPeriod>> close(@PathVariable("period") String period,
                                                               @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Donem kapatildi", periodService.close(period, body != null ? body.get("note") : null)));
    }

    @PostMapping("/accounting/periods/{period}/reopen")
    @PreAuthorize("@perm.can('PERIOD_MANAGE')")
    @Operation(summary = "Donemi gerekceli olarak yeniden ac (Mali Musavir veya Yonetici)")
    public ResponseEntity<ApiResponse<AccountingPeriod>> reopen(@PathVariable("period") String period,
                                                                @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Donem yeniden acildi", periodService.reopen(period, body != null ? body.get("reason") : null)));
    }

    // ── Denetim izi ────────────────────────────────────────────

    @GetMapping("/audit-logs")
    @PreAuthorize("@perm.can('AUDIT_VIEW')")
    @Operation(summary = "Denetim izi (salt okunur)")
    public ResponseEntity<ApiResponse<PageResponse<AuditLog>>> auditLogs(
            @RequestParam(name = "entityType", required = false) String entityType,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "sort", required = false) String sort,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size,
            @RequestParam(name = "limit", required = false) Integer limit) {
        return ResponseEntity.ok(ApiResponse.ok("Denetim kayitlari",
                auditService.page(entityType, q, page, size != null ? size : limit, sort)));
    }
}
