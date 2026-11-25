package com.gastrosync.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.service.ExpenseService;
import com.gastrosync.service.InventoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/inventory")
@Tag(name = "Stok & Envanter", description = "Stok kartlari, mal kabul, fire, sayim ve tedarik talepleri")
public class InventoryController {

    private final InventoryService inventoryService;
    private final ExpenseService expenseService;
    private final com.gastrosync.service.ApprovalService approvalService;

    public InventoryController(InventoryService inventoryService, ExpenseService expenseService,
                               com.gastrosync.service.ApprovalService approvalService) {
        this.inventoryService = inventoryService;
        this.expenseService = expenseService;
        this.approvalService = approvalService;
    }

    @GetMapping
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    @Operation(summary = "Tum stok kalemleri")
    public ResponseEntity<ApiResponse<List<InventoryItem>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Stok listesi", inventoryService.getAllItems()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    public ResponseEntity<ApiResponse<InventoryItem>> getById(@PathVariable("id") Long id) {
        InventoryItem item = inventoryService.getItemById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Urun bulunamadi: " + id));
        return ResponseEntity.ok(ApiResponse.ok("Urun bulundu", item));
    }

    @GetMapping("/barcode/{barcode}")
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    public ResponseEntity<ApiResponse<InventoryItem>> getByBarcode(@PathVariable("barcode") String barcode) {
        InventoryItem item = inventoryService.getItemByBarcode(barcode)
                .orElseThrow(() -> new ResourceNotFoundException("Barkod sistemde bulunamadi: " + barcode));
        return ResponseEntity.ok(ApiResponse.ok("Barkod eslesti", item));
    }

    @GetMapping("/valuation")
    @PreAuthorize("@perm.can('INVENTORY_VALUATION')")
    @Operation(summary = "Envanter degerlemesi (agirlikli ortalama maliyet)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> valuation() {
        return ResponseEntity.ok(ApiResponse.ok("Envanter degerlemesi", inventoryService.getValuation()));
    }

    @PostMapping
    @PreAuthorize("@perm.can('INVENTORY_ITEM_MANAGE')")
    @Operation(summary = "Yeni stok karti (acilis stogu hareket olarak kaydedilir)")
    public ResponseEntity<ApiResponse<InventoryItem>> create(@Valid @RequestBody InventoryItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Stok karti olusturuldu", inventoryService.createItem(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('INVENTORY_ITEM_MANAGE', 'INVENTORY_COST_EDIT')")
    @Operation(summary = "Stok karti bilgilerini guncelle (miktar degismez; maliyet yalnizca Yonetici/Mudur)")
    public ResponseEntity<ApiResponse<InventoryItem>> update(@PathVariable("id") Long id,
                                                             @Valid @RequestBody InventoryItemRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Stok karti guncellendi", inventoryService.updateItem(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.can('INVENTORY_ITEM_MANAGE')")
    @Operation(summary = "Stok kartini arsivle (stok sifir ve recetede kullanilmiyor olmali)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delete(@PathVariable("id") Long id) {
        inventoryService.deleteItem(id);
        return ResponseEntity.ok(ApiResponse.ok("Stok karti arsivlendi", Map.of("id", id)));
    }

    @PostMapping("/{id}/receive")
    @PreAuthorize("@perm.can('INVENTORY_RECEIVE')")
    @Operation(summary = "Mal kabul (alis fiyati girilirse agirlikli ortalama maliyet guncellenir)")
    public ResponseEntity<ApiResponse<StockTransaction>> receiveStock(@PathVariable("id") Long id,
                                                                      @RequestBody Map<String, Object> payload) {
        BigDecimal quantity = decimal(payload.get("quantity"), "quantity");
        BigDecimal unitCost = payload.get("unitCost") != null && !payload.get("unitCost").toString().isBlank()
                ? decimal(payload.get("unitCost"), "unitCost") : null;
        String documentNo = payload.get("documentNo") != null ? payload.get("documentNo").toString() : null;
        Long expenseId = payload.get("expenseId") != null && !payload.get("expenseId").toString().isBlank()
                ? Long.valueOf(payload.get("expenseId").toString()) : null;
        StockTransaction tx = inventoryService.receiveStock(id, quantity, unitCost, documentNo, expenseId);
        return ResponseEntity.ok(ApiResponse.ok(tx.getItem().getName() + " icin +" + quantity.stripTrailingZeros().toPlainString()
                + " " + tx.getItem().getUnit() + " mal kabul kaydedildi", tx));
    }

    @PostMapping("/{id}/waste")
    @PreAuthorize("@perm.can('INVENTORY_WASTE')")
    @Operation(summary = "Fire / zayiat (stoktan fazla olamaz, neden zorunlu)")
    public ResponseEntity<ApiResponse<StockTransaction>> recordWaste(@PathVariable("id") Long id,
                                                                     @RequestBody Map<String, Object> payload) {
        BigDecimal quantity = decimal(payload.get("quantity"), "quantity");
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        StockTransaction tx = inventoryService.recordWaste(id, quantity, reason, null);
        return ResponseEntity.ok(ApiResponse.ok(tx.getItem().getName() + " icin -" + quantity.stripTrailingZeros().toPlainString()
                + " " + tx.getItem().getUnit() + " fire kaydedildi", tx));
    }

    @PostMapping("/{id}/adjust")
    @PreAuthorize("@perm.can('INVENTORY_COUNT')")
    @Operation(summary = "Fiziki sayim sonucu stok duzeltmesi (gerekceli). Esigi asan fark Mudur onayina gider (202)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> adjust(@PathVariable("id") Long id,
                                                                   @RequestBody Map<String, Object> payload) {
        BigDecimal counted = decimal(payload.get("countedQuantity"), "countedQuantity");
        String reason = payload.get("reason") != null ? payload.get("reason").toString() : null;
        Map<String, Object> result = approvalService.submitCount(id, counted, reason);
        if (Boolean.TRUE.equals(result.get("approvalRequired"))) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.ACCEPTED)
                    .body(ApiResponse.ok("Sayim farki onay esigini asti; Isletme Muduru onayina gonderildi", result));
        }
        return ResponseEntity.ok(ApiResponse.ok("Sayim duzeltmesi kaydedildi", result));
    }

    @PostMapping("/{id}/purchase-request")
    @PreAuthorize("@perm.can('PURCHASE_REQUEST')")
    @Operation(summary = "Tedarik (satin alma) talebi: muhasebe onayina tahmini tutarli gider kaydi acar")
    public ResponseEntity<ApiResponse<ExpenseResponse>> purchaseRequest(@PathVariable("id") Long id,
                                                                        @RequestBody Map<String, Object> payload) {
        BigDecimal quantity = decimal(payload.get("quantity"), "quantity");
        boolean urgent = payload.get("urgent") != null && Boolean.parseBoolean(payload.get("urgent").toString());
        String note = payload.get("note") != null ? payload.get("note").toString() : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Tedarik talebi muhasebe onayina iletildi",
                expenseService.createPurchaseRequest(id, quantity, urgent, note)));
    }

    @GetMapping("/pending-deliveries")
    @PreAuthorize("@perm.can('DELIVERY_VIEW')")
    @Operation(summary = "Depoya beklenen tedarik teslimatlari")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pendingDeliveries() {
        return ResponseEntity.ok(ApiResponse.ok("Bekleyen teslimatlar", inventoryService.getPendingDeliveries()));
    }

    @GetMapping("/transactions")
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    @Operation(summary = "Sayfali stok hareket defteri")
    public ResponseEntity<ApiResponse<PageResponse<StockTransaction>>> transactions(
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "itemId", required = false) Long itemId,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "sort", required = false) String sort,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.ok("Stok hareketleri", inventoryService.transactionsPage(type, itemId, q, page, size, sort)));
    }

    @GetMapping("/transactions/recent")
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    @Operation(summary = "Son stok hareketleri")
    public ResponseEntity<ApiResponse<List<StockTransaction>>> getRecentTransactions() {
        return ResponseEntity.ok(ApiResponse.ok("Son depo hareketleri", inventoryService.getRecentTransactions()));
    }

    @GetMapping("/{id}/transactions")
    @PreAuthorize("@perm.can('INVENTORY_VIEW')")
    @Operation(summary = "Stok kalemine ait hareket defteri")
    public ResponseEntity<ApiResponse<List<StockTransaction>>> getItemTransactions(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Stok hareketleri", inventoryService.getItemTransactions(id)));
    }

    static BigDecimal decimal(Object value, String field) {
        if (value == null || value.toString().isBlank()) {
            throw new IllegalArgumentException("'" + field + "' alani zorunludur");
        }
        try {
            return new BigDecimal(value.toString().trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("'" + field + "' gecerli bir sayi olmalidir");
        }
    }
}
