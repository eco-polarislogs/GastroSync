package com.gastrosync.controller;

import java.util.Map;

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
import com.gastrosync.service.ApprovalService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Roller arasi onay talepleri: Kasiyer (iptal / ikram / indirim) ve Depo (esigi asan sayim farki) talep acar,
 * Isletme Muduru onaylar veya gerekceli reddeder. Ayrintili yetki kontrolu ApprovalService'tedir.
 */
@RestController
@RequestMapping("/api/approvals")
@Tag(name = "Onay Talepleri", description = "Yonetici onayi gerektiren islemler: talep, onay, ret, geri cekme")
public class ApprovalController {

    private final ApprovalService approvalService;

    public ApprovalController(ApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Talepler: scope=inbox (karar bekleyenler), mine (taleplerim), all (gecmis)")
    public ResponseEntity<ApiResponse<PageResponse<Map<String, Object>>>> list(
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.ok("Onay talepleri", approvalService.list(scope, status, page, size)));
    }

    @GetMapping("/summary")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Bekleyen talep sayilari (rozetler icin)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary() {
        return ResponseEntity.ok(ApiResponse.ok("Onay ozeti", approvalService.summary()));
    }

    @PostMapping
    @PreAuthorize("@perm.can('POS_OPERATE', 'INVENTORY_COUNT')")
    @Operation(summary = "Onay talebi ac: type=ITEM_VOID|CHECK_VOID|COMP|DISCOUNT|STOCK_ADJUST, targetId, reason")
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(@RequestBody Map<String, Object> body) {
        ApprovalService.RequestInput in = new ApprovalService.RequestInput(
                str(body.get("type")),
                body.get("targetId") == null ? null : Long.valueOf(body.get("targetId").toString().replace(".0", "")),
                str(body.get("reason")),
                PosController.optionalDecimal(body.get("percent"), "percent"),
                PosController.optionalDecimal(body.get("amount"), "amount"),
                PosController.optionalDecimal(body.get("countedQuantity"), "countedQuantity"));
        Map<String, Object> result = approvalService.request(in);
        boolean pending = Boolean.TRUE.equals(result.get("approvalRequired"));
        return ResponseEntity.status(pending ? HttpStatus.CREATED : HttpStatus.OK)
                .body(ApiResponse.ok(pending ? "Talep Isletme Muduru onayina gonderildi" : "Islem uygulandi", result));
    }

    @PutMapping("/{id}/decide")
    @PreAuthorize("@perm.can('POS_CANCEL_APPROVE', 'POS_DISCOUNT_APPROVE', 'INVENTORY_ADJUST_APPROVE')")
    @Operation(summary = "Karar: decision=APPROVE|REJECT, note (retde zorunlu)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decide(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        String decision = str(body.get("decision"));
        boolean approve;
        if ("APPROVE".equalsIgnoreCase(decision)) approve = true;
        else if ("REJECT".equalsIgnoreCase(decision)) approve = false;
        else throw new IllegalArgumentException("decision APPROVE veya REJECT olmalidir");
        Map<String, Object> result = approvalService.decide(id, approve, str(body.get("note")));
        String status = String.valueOf(result.get("status"));
        String msg = switch (status) {
            case "APPROVED" -> "Talep onaylandi ve islem uygulandi";
            case "REJECTED" -> "Talep reddedildi";
            default -> "Talep uygulanamadi: " + result.get("decisionNote");
        };
        return ResponseEntity.ok(ApiResponse.ok(msg, result));
    }

    @PutMapping("/{id}/withdraw")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Talebi geri cek (yalnizca talep acan)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> withdraw(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Talep geri cekildi", approvalService.withdraw(id)));
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
