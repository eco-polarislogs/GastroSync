package com.gastrosync.service;

import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Yonetici paneli KPI ozeti (icinde bulunulan ay). Hesaplamalar ReportService'tedir.
 */
@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private final ReportService reportService;

    public AnalyticsService(ReportService reportService) {
        this.reportService = reportService;
    }

    public Map<String, Object> getFinancialSummary() {
        return reportService.dashboardSummary();
    }
}
