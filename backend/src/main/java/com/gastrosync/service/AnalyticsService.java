package com.gastrosync.service;

import com.gastrosync.model.SalesRecord;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.PosOrderRepository;
import com.gastrosync.repository.SalesRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class AnalyticsService {

    private final PosOrderRepository posOrderRepository;
    private final SalesRecordRepository salesRecordRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final com.gastrosync.repository.StockTransactionRepository stockTransactionRepository;

    public AnalyticsService(PosOrderRepository posOrderRepository, 
                            SalesRecordRepository salesRecordRepository,
                            InventoryItemRepository inventoryItemRepository,
                            com.gastrosync.repository.StockTransactionRepository stockTransactionRepository) {
        this.posOrderRepository = posOrderRepository;
        this.salesRecordRepository = salesRecordRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.stockTransactionRepository = stockTransactionRepository;
    }

    /**
     * Günlük Yönetici Finans ve KPI Özeti
     */
    public Map<String, Object> getFinancialSummary() {
        BigDecimal totalRevenue = posOrderRepository.calculateTotalRevenue();
        BigDecimal totalCost = posOrderRepository.calculateTotalCost();

        if (totalRevenue == null || totalRevenue.compareTo(BigDecimal.ZERO) == 0) {
            // Fallback to sales table if pos_orders not closed
            List<SalesRecord> sales = salesRecordRepository.findAll();
            totalRevenue = sales.stream().map(s -> s.getTotalPrice() != null ? s.getTotalPrice() : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
            totalCost = stockTransactionRepository.calculateTotalCogs();
            if (totalCost == null) {
                totalCost = BigDecimal.ZERO;
            }
        }

        BigDecimal netProfit = totalRevenue.subtract(totalCost);
        BigDecimal foodCostPercent = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalCost.divide(totalRevenue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalCost", totalCost);
        summary.put("netProfit", netProfit);
        summary.put("foodCostPercent", foodCostPercent.setScale(1, RoundingMode.HALF_UP));
        summary.put("targetFoodCostPercent", new BigDecimal("30.0"));
        summary.put("criticalStockCount", inventoryItemRepository.findAll().stream()
                .filter(i -> i.getCurrentStock().compareTo(i.getMinStock()) <= 0).count());

        return summary;
    }
}
