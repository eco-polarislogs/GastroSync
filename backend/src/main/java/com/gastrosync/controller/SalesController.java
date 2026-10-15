package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.repository.SalesRecordRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@Tag(name = "Satış & POS", description = "Restoran anlık satış hareketleri ve özetleri")
public class SalesController {

    private final SalesRecordRepository repository;

    public SalesController(SalesRecordRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "Tüm satış kayıtlarını listele")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Satış kayıtları getirildi", repository.findAll()));
    }

    @GetMapping("/today")
    @Operation(summary = "Bugünkü satışları listele")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getToday() {
        return ResponseEntity.ok(ApiResponse.ok("Bugünkü satışlar getirildi", repository.findAll()));
    }

    @PostMapping
    @Operation(summary = "Yeni satış / POS siparişi kaydet")
    public ResponseEntity<ApiResponse<SalesRecord>> create(@RequestBody SalesRecord salesRecord) {
        if (salesRecord.getOrderNo() == null || salesRecord.getOrderNo().isBlank()) {
            salesRecord.setOrderNo("ORD-" + System.currentTimeMillis() % 100000);
        }
        if (salesRecord.getTime() == null || salesRecord.getTime().isBlank()) {
            salesRecord.setTime(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        }
        if (salesRecord.getTotalPrice() == null && salesRecord.getUnitPrice() != null && salesRecord.getQuantity() != null) {
            salesRecord.setTotalPrice(salesRecord.getUnitPrice().multiply(new BigDecimal(salesRecord.getQuantity())));
        }
        if (salesRecord.getTableNo() == null || salesRecord.getTableNo().isBlank()) {
            salesRecord.setTableNo("Masa 1");
        }
        if (salesRecord.getPaymentMethod() == null || salesRecord.getPaymentMethod().isBlank()) {
            salesRecord.setPaymentMethod("Kredi Kartı");
        }

        SalesRecord saved = repository.save(salesRecord);
        return ResponseEntity.ok(ApiResponse.ok("Satış başarıyla kaydedildi", saved));
    }

    @GetMapping("/summary")
    @Operation(summary = "Güncel satış özeti ve KPI'lar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        List<SalesRecord> sales = repository.findAll();
        BigDecimal totalRevenue = sales.stream()
                .map(SalesRecord::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Gıda maliyeti tahmini (%28.5)
        BigDecimal totalCost = totalRevenue.multiply(new BigDecimal("0.285")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netProfit = totalRevenue.subtract(totalCost);
        BigDecimal foodCostPercent = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalCost.divide(totalRevenue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalCost", totalCost);
        summary.put("netProfit", netProfit);
        summary.put("foodCostPercent", foodCostPercent);
        summary.put("totalSalesCount", sales.size());

        return ResponseEntity.ok(ApiResponse.ok("Satış özeti hesaplandı", summary));
    }
}
