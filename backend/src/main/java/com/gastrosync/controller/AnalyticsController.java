package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.service.AnalyticsService;
import com.gastrosync.service.PricingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@Tag(name = "Finansal Analiz & KPI", description = "Ciro, maliyet, gıda maliyeti (food cost) ve marj göstergeleri")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final PricingService pricingService;

    public AnalyticsController(AnalyticsService analyticsService, PricingService pricingService) {
        this.analyticsService = analyticsService;
        this.pricingService = pricingService;
    }

    @GetMapping("/menu-pricing")
    @PreAuthorize("@perm.can('PRICING_VIEW')")
    @Operation(summary = "Menu muhendisligi, onerilen fiyatlar, malzeme fiyat dalgalanmasi ve uyarilar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> menuPricing(@RequestParam(name = "days", required = false) Integer days) {
        return ResponseEntity.ok(ApiResponse.ok("Menu fiyat analizi hazirlandi", pricingService.menuPricing(days)));
    }

    @GetMapping("/summary")
    @PreAuthorize("@perm.can('DASHBOARD_VIEW', 'FINANCE_SUMMARY_VIEW')")
    @Operation(summary = "Yönetici günlük finansal KPI ve food cost özetini getir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFinancialSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Finansal KPI özeti hesaplandı", analyticsService.getFinancialSummary()));
    }
}
