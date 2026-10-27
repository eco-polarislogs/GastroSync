package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@Tag(name = "Finansal Analiz & KPI", description = "Ciro, maliyet, gıda maliyeti (food cost) ve marj göstergeleri")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Yönetici günlük finansal KPI ve food cost özetini getir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFinancialSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Finansal KPI özeti hesaplandı", analyticsService.getFinancialSummary()));
    }
}
