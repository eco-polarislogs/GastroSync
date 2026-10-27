package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.service.SalesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@Tag(name = "Satış & POS", description = "Restoran anlık satış hareketleri ve özetleri")
public class SalesController {

    private final SalesService salesService;

    public SalesController(SalesService salesService) {
        this.salesService = salesService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Tüm satış kayıtlarını listele")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Satış kayıtları getirildi", salesService.getAllSales()));
    }

    @GetMapping("/today")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Bugünkü satışları listele")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getToday() {
        return ResponseEntity.ok(ApiResponse.ok("Bugünkü satışlar getirildi", salesService.getTodaySales()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'CHEF', 'ACCOUNTANT')")
    @Operation(summary = "Yeni satış / POS siparişi kaydet (Otomatik Reçete Hammadde Düşümü)")
    public ResponseEntity<ApiResponse<SalesRecord>> create(@RequestBody SalesRecord salesRecord) {
        SalesRecord saved = salesService.recordSale(salesRecord);
        return ResponseEntity.ok(ApiResponse.ok("Satış başarıyla kaydedildi ve hammadde stok düşümü yapıldı", saved));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Güncel satış özeti ve KPI'lar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Satış özeti hesaplandı", salesService.getSalesSummary()));
    }
}
