package com.gastrosync.controller;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.PageResponse;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.service.SalesService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/sales")
@Tag(name = "Satis & POS", description = "Recete fiyatli POS satislari, iptal ve ozetler")
public class SalesController {

    private final SalesService salesService;

    public SalesController(SalesService salesService) {
        this.salesService = salesService;
    }

    @GetMapping
    @PreAuthorize("@perm.can('SALES_VIEW')")
    @Operation(summary = "Satislar (tarih araligi; varsayilan bugun)")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getAll(
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "includeVoided", defaultValue = "false") boolean includeVoided) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end;
        if (start.isAfter(end)) throw new IllegalArgumentException("Baslangic tarihi bitis tarihinden sonra olamaz");
        if (start.plusDays(366).isBefore(end)) throw new IllegalArgumentException("En fazla 1 yillik aralik sorgulanabilir");
        return ResponseEntity.ok(ApiResponse.ok("Satislar", salesService.getSales(start, end, includeVoided)));
    }

    @GetMapping("/search")
    @PreAuthorize("@perm.can('SALES_VIEW')")
    @Operation(summary = "Sayfali satis hareketleri")
    public ResponseEntity<ApiResponse<PageResponse<SalesRecord>>> search(
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "includeVoided", defaultValue = "true") boolean includeVoided,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "paymentMethod", required = false) String paymentMethod,
            @RequestParam(name = "sort", required = false) String sort,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end;
        if (start.isAfter(end)) throw new IllegalArgumentException("Baslangic tarihi bitis tarihinden sonra olamaz");
        return ResponseEntity.ok(ApiResponse.ok("Satislar", salesService.search(start, end, includeVoided, q, paymentMethod, page, size, sort)));
    }

    @GetMapping("/range-summary")
    @PreAuthorize("@perm.can('SALES_VIEW')")
    @Operation(summary = "Tarih araligi satis ozeti ve urun kirilimi")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rangeSummary(
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end;
        if (start.isAfter(end)) throw new IllegalArgumentException("Baslangic tarihi bitis tarihinden sonra olamaz");
        if (start.plusDays(366).isBefore(end)) throw new IllegalArgumentException("En fazla 1 yillik aralik sorgulanabilir");
        return ResponseEntity.ok(ApiResponse.ok("Satis ozeti", salesService.rangeSummary(start, end)));
    }

    @GetMapping("/today")
    @PreAuthorize("@perm.can('SALES_VIEW')")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> getToday() {
        return ResponseEntity.ok(ApiResponse.ok("Bugunku satislar", salesService.getTodaySales()));
    }

    @GetMapping("/summary")
    @PreAuthorize("@perm.can('SALES_VIEW')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Bugunku satis ozeti", salesService.getSalesSummary()));
    }

    @PostMapping
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Tek kalem satis (fiyat sunucuda receteden alinir)")
    public ResponseEntity<ApiResponse<SalesRecord>> create(@RequestBody SalesRecord salesRecord) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Satis kaydedildi ve receteden stok dusuldu", salesService.recordSale(salesRecord)));
    }

    @PostMapping("/order")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Coklu kalem POS siparisi (atomik)")
    public ResponseEntity<ApiResponse<List<SalesRecord>>> createOrder(@RequestBody Map<String, Object> body) {
        Object rawItems = body.get("items");
        if (!(rawItems instanceof List<?> items) || items.isEmpty()) {
            throw new IllegalArgumentException("Siparis kalemleri (items) zorunludur");
        }
        List<SalesService.OrderLine> lines = new ArrayList<>();
        for (Object o : items) {
            if (!(o instanceof Map<?, ?> m)) throw new IllegalArgumentException("Gecersiz siparis kalemi");
            Long recipeId = m.get("recipeId") != null && !m.get("recipeId").toString().isBlank()
                    ? Long.valueOf(m.get("recipeId").toString().replace(".0", "")) : null;
            String name = m.get("productName") != null ? m.get("productName").toString() : null;
            Integer qty = m.get("quantity") != null ? Integer.valueOf(m.get("quantity").toString().replace(".0", "")) : 1;
            lines.add(new SalesService.OrderLine(recipeId, name, qty));
        }
        String table = body.get("tableNo") != null ? body.get("tableNo").toString() : null;
        String method = body.get("paymentMethod") != null ? body.get("paymentMethod").toString() : null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Siparis kaydedildi", salesService.recordOrder(table, method, null, lines)));
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("@perm.can('SALES_VOID')")
    @Operation(summary = "Gerekceli satis iptali (stok ters kayitla iade edilir)")
    public ResponseEntity<ApiResponse<SalesRecord>> voidSale(@PathVariable("id") Long id,
                                                             @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.ok("Satis iptal edildi", salesService.voidSale(id, reason)));
    }
}
