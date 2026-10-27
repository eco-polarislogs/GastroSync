package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@Tag(name = "Stok & Envanter Yönetimi", description = "Tüm hammadde stokları, barkod sorgulama, mal kabul ve fire/zayiat API'leri")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'CHEF', 'WAREHOUSE', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Tüm hammadde stoklarını listele")
    public ResponseEntity<ApiResponse<List<InventoryItem>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Stok listesi başarıyla getirildi", inventoryService.getAllItems()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'CHEF', 'WAREHOUSE', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "ID ile stok kalemi detayı getir")
    public ResponseEntity<ApiResponse<InventoryItem>> getById(@PathVariable("id") Long id) {
        return inventoryService.getItemById(id)
                .map(item -> ResponseEntity.ok(ApiResponse.ok("Ürün bulundu", item)))
                .orElse(ResponseEntity.status(404).body(ApiResponse.error("Belirtilen ID ile ürün bulunamadı: " + id)));
    }

    @GetMapping("/barcode/{barcode}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'CHEF', 'WAREHOUSE', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Barkod veya QR kod ile ürün sorgula")
    public ResponseEntity<ApiResponse<InventoryItem>> getByBarcode(@PathVariable("barcode") String barcode) {
        return inventoryService.getItemByBarcode(barcode)
                .map(item -> ResponseEntity.ok(ApiResponse.ok("Barkod başarıyla eşleşti", item)))
                .orElse(ResponseEntity.status(404).body(ApiResponse.error("Barkod sistemde bulunamadı: " + barcode)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'WAREHOUSE')")
    @Operation(summary = "Yeni hammadde/stok kalemi ekle")
    public ResponseEntity<ApiResponse<InventoryItem>> create(@RequestBody InventoryItem item) {
        InventoryItem saved = inventoryService.saveItem(item);
        return ResponseEntity.ok(ApiResponse.ok("Yeni ürün stoğa kaydedildi", saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'WAREHOUSE')")
    @Operation(summary = "Mevcut stok kalemini güncelle")
    public ResponseEntity<ApiResponse<InventoryItem>> update(@PathVariable("id") Long id, @RequestBody InventoryItem updated) {
        return inventoryService.getItemById(id).map(item -> {
            item.setName(updated.getName());
            item.setCategory(updated.getCategory());
            item.setCurrentStock(updated.getCurrentStock());
            item.setMinStock(updated.getMinStock());
            item.setUnit(updated.getUnit());
            item.setUnitCost(updated.getUnitCost());
            item.setSupplier(updated.getSupplier());
            item.setBarcode(updated.getBarcode());
            item.setLastUpdated(updated.getLastUpdated());
            InventoryItem saved = inventoryService.saveItem(item);
            return ResponseEntity.ok(ApiResponse.ok("Stok bilgileri güncellendi", saved));
        }).orElse(ResponseEntity.status(404).body(ApiResponse.error("Güncellenecek ürün bulunamadı")));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'WAREHOUSE', 'CHEF')")
    @Operation(summary = "Mal kabul işlemi yap (Stoğa miktar ekler ve loglar)")
    public ResponseEntity<ApiResponse<StockTransaction>> receiveStock(@PathVariable("id") Long id, @RequestBody Map<String, Object> payload) {
        if (!payload.containsKey("quantity")) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lütfen eklenecek miktarı ('quantity') belirtin"));
        }
        BigDecimal quantity = new BigDecimal(payload.get("quantity").toString());
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Giriş miktarı 0'dan büyük olmalıdır"));
        }

        // Enterprise Security: Strictly extract operator from SecurityContextHolder (prevents audit forgery)
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String recordedBy = (auth != null && auth.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(auth.getName()))
                ? auth.getName()
                : "SYSTEM";

        StockTransaction tx = inventoryService.receiveStock(id, quantity, recordedBy);
        return ResponseEntity.ok(ApiResponse.ok(tx.getItem().getName() + " için +" + quantity + " " + tx.getItem().getUnit() + " mal kabulü onaylandı", tx));
    }

    @PostMapping("/{id}/waste")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'WAREHOUSE', 'CHEF')")
    @Operation(summary = "Zayiat / Fire kaydı oluştur (Stoktan düşer ve loglar)")
    public ResponseEntity<ApiResponse<StockTransaction>> recordWaste(@PathVariable("id") Long id, @RequestBody Map<String, Object> payload) {
        if (!payload.containsKey("quantity")) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lütfen zayiat miktarını ('quantity') belirtin"));
        }
        BigDecimal quantity = new BigDecimal(payload.get("quantity").toString());
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Zayiat miktarı 0'dan büyük olmalıdır"));
        }
        String reason = payload.getOrDefault("reason", "Genel Zayiat").toString();

        // Enterprise Security: Strictly extract operator from SecurityContextHolder (prevents audit forgery)
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String recordedBy = (auth != null && auth.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(auth.getName()))
                ? auth.getName()
                : "SYSTEM";

        StockTransaction tx = inventoryService.recordWaste(id, quantity, reason, recordedBy);
        return ResponseEntity.ok(ApiResponse.ok(tx.getItem().getName() + " için -" + quantity + " " + tx.getItem().getUnit() + " zayiat kaydedildi", tx));
    }

    @GetMapping("/transactions/recent")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'WAREHOUSE', 'CHEF', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Son mal kabul ve zayiat denetim loglarını listele")
    public ResponseEntity<ApiResponse<List<StockTransaction>>> getRecentTransactions() {
        return ResponseEntity.ok(ApiResponse.ok("Son depo hareketleri getirildi", inventoryService.getRecentTransactions()));
    }
}
