package com.gastrosync.controller;

import java.math.BigDecimal;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.PageResponse;
import com.gastrosync.model.DiningTable;
import com.gastrosync.service.PosService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Masa & adisyon (Kasa Sorumlusu). Tahsilat SalesService uzerinden satis kaydi, stok dusumu ve KDV uretir.
 */
@RestController
@RequestMapping("/api/pos")
@Tag(name = "Masa & Adisyon", description = "Masalar, adisyon kalemleri, mutfak ekrani ve tahsilat")
public class PosController {

    private final PosService posService;

    public PosController(PosService posService) {
        this.posService = posService;
    }

    @GetMapping("/tables")
    @PreAuthorize("@perm.can('POS_VIEW')")
    @Operation(summary = "Masalar ve acik adisyon ozetleri")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> tables() {
        return ResponseEntity.ok(ApiResponse.ok("Masalar", posService.tables()));
    }

    @PostMapping("/tables")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    @Operation(summary = "Masa ekle (benzersiz masa numarasi)")
    public ResponseEntity<ApiResponse<DiningTable>> createTable(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Masa eklendi",
                posService.createTable(integer(body.get("number")), str(body.get("area")), integer(body.get("capacity")))));
    }

    @PutMapping("/tables/{id}")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    @Operation(summary = "Masa bolumu / kapasite / kullanim durumu")
    public ResponseEntity<ApiResponse<DiningTable>> updateTable(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        Boolean active = body.get("active") == null ? null : Boolean.valueOf(body.get("active").toString());
        return ResponseEntity.ok(ApiResponse.ok("Masa guncellendi",
                posService.updateTable(id, str(body.get("area")), integer(body.get("capacity")), active)));
    }

    @GetMapping("/menu")
    @PreAuthorize("@perm.can('POS_VIEW')")
    @Operation(summary = "Satisa acik menu (maliyet bilgisi icermez; stok uygunlugu ile)")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> menu() {
        return ResponseEntity.ok(ApiResponse.ok("Menu", posService.menu()));
    }

    @PostMapping("/tables/{id}/open")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Masaya adisyon ac (acik adisyon varsa onu dondurur)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> open(@PathVariable("id") Long id,
                                                                 @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyon acik",
                posService.openCheck(id, body != null ? integer(body.get("guestCount")) : null)));
    }

    @GetMapping("/checks/{id}")
    @PreAuthorize("@perm.can('POS_VIEW', 'KITCHEN_VIEW')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> check(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyon", posService.checkDetail(id)));
    }

    @PostMapping("/checks/{id}/items")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Adisyona yemek / icecek ekle ve mutfaga ilet")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addItems(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        List<PosService.ItemInput> items = new ArrayList<>();
        Object raw = body.get("items");
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    items.add(new PosService.ItemInput(longValue(m.get("recipeId")), integer(m.get("quantity")), str(m.get("note"))));
                }
            }
        }
        return ResponseEntity.ok(ApiResponse.ok("Siparis mutfaga iletildi", posService.addItems(id, items)));
    }

    @PutMapping("/items/{id}/status")
    @PreAuthorize("@perm.can('KITCHEN_OPERATE', 'POS_OPERATE')")
    @Operation(summary = "Mutfak durumu: PREPARING, READY (Sef) / SERVED (Kasa)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> itemStatus(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Kalem durumu guncellendi", posService.updateItemStatus(id, str(body.get("status")))));
    }

    @PutMapping("/items/{id}/cancel")
    @PreAuthorize("@perm.can('POS_OPERATE', 'POS_CANCEL_APPROVE')")
    @Operation(summary = "Kalemi gerekceli iptal et")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancelItem(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Kalem iptal edildi", posService.cancelItem(id, str(body.get("reason")))));
    }

    @PutMapping("/items/{id}/comp")
    @PreAuthorize("@perm.can('POS_DISCOUNT_APPROVE')")
    @Operation(summary = "Kalemi ikram et (Mudur). Kasiyer /api/approvals ile COMP talebi gonderir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> comp(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Kalem ikram edildi", posService.compItem(id, str(body.get("reason")))));
    }

    @PutMapping("/checks/{id}/discount")
    @PreAuthorize("@perm.can('POS_DISCOUNT_APPROVE')")
    @Operation(summary = "Adisyona yuzde veya tutar indirimi (Mudur). Kasiyer /api/approvals ile DISCOUNT talebi gonderir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> discount(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        BigDecimal percent = optionalDecimal(body.get("percent"), "percent");
        BigDecimal amount = optionalDecimal(body.get("amount"), "amount");
        return ResponseEntity.ok(ApiResponse.ok("Indirim uygulandi", posService.setDiscount(id, percent, amount, str(body.get("reason")))));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/checks/{id}/discount")
    @PreAuthorize("@perm.can('POS_DISCOUNT_APPROVE')")
    @Operation(summary = "Adisyon indirimini kaldir (Mudur)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> removeDiscount(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Indirim kaldirildi", posService.removeDiscount(id)));
    }

    static BigDecimal optionalDecimal(Object value, String field) {
        return value == null || value.toString().isBlank() ? null : InventoryController.decimal(value, field);
    }

    @PutMapping("/checks/{id}/transfer")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Adisyonu bos bir masaya tasi")
    public ResponseEntity<ApiResponse<Map<String, Object>>> transfer(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyon tasindi", posService.transfer(id, longValue(body.get("tableId")))));
    }

    @PostMapping("/checks/{id}/pay")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Tahsilat: satis kaydi + stok dusumu + adisyon kapanisi (atomik)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pay(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        BigDecimal received = body.get("receivedAmount") == null || body.get("receivedAmount").toString().isBlank()
                ? null : InventoryController.decimal(body.get("receivedAmount"), "receivedAmount");
        return ResponseEntity.ok(ApiResponse.ok("Tahsilat kaydedildi", posService.pay(id, str(body.get("paymentMethod")), received)));
    }

    @PostMapping("/checks/{id}/payments")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Parcali odeme / hesap bolme: tutar, kalem listesi (itemIds) veya kalanin tamami; kalan sifirlaninca adisyon kapanir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addPayment(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        BigDecimal amount = body.get("amount") == null || body.get("amount").toString().isBlank()
                ? null : InventoryController.decimal(body.get("amount"), "amount");
        BigDecimal received = body.get("receivedAmount") == null || body.get("receivedAmount").toString().isBlank()
                ? null : InventoryController.decimal(body.get("receivedAmount"), "receivedAmount");
        java.util.List<Long> itemIds = null;
        if (body.get("itemIds") instanceof java.util.List<?> raw) {
            itemIds = new java.util.ArrayList<>();
            for (Object o : raw) itemIds.add(longValue(o));
        }
        Map<String, Object> res = posService.addPayment(id, str(body.get("paymentMethod")), amount, itemIds, received, str(body.get("label")));
        return ResponseEntity.ok(ApiResponse.ok(Boolean.TRUE.equals(res.get("closed")) ? "Tahsilat tamamlandi, adisyon kapandi" : "Kismi tahsilat kaydedildi", res));
    }

    @PutMapping("/payments/{id}/void")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Kapanmamis adisyondaki kismi tahsilati gerekceyle geri al (Mudur bilgilendirilir)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> voidPayment(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Tahsilat geri alindi", posService.voidPayment(id, str(body.get("reason")))));
    }

    @PutMapping("/checks/{id}/cancel")
    @PreAuthorize("@perm.can('POS_OPERATE', 'POS_CANCEL_APPROVE')")
    @Operation(summary = "Adisyonu gerekceli iptal et")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyon iptal edildi", posService.cancelCheck(id, str(body.get("reason")))));
    }

    @GetMapping("/kitchen")
    @PreAuthorize("@perm.can('KITCHEN_VIEW')")
    @Operation(summary = "Mutfak ekrani: bekleyen / hazirlanan / hazir kalemler")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> kitchen() {
        return ResponseEntity.ok(ApiResponse.ok("Mutfak siparisleri", posService.kitchenBoard()));
    }

    @GetMapping("/summary")
    @PreAuthorize("@perm.can('POS_VIEW', 'CASH_REPORT_VIEW')")
    @Operation(summary = "Gunun kasa ozeti: acik masalar, tahsilat, odeme turleri")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary(
            @RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok("Kasa ozeti", posService.summary(date)));
    }

    @GetMapping("/checks")
    @PreAuthorize("@perm.can('POS_VIEW', 'SALES_VIEW')")
    @Operation(summary = "Kapanmis adisyonlar (sayfali)")
    public ResponseEntity<ApiResponse<PageResponse<Map<String, Object>>>> closedChecks(
            @RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.ok("Adisyonlar", posService.closedChecks(date, status, page, size)));
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static Integer integer(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try {
            return (int) Double.parseDouble(o.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Gecersiz sayi: " + o);
        }
    }

    private static Long longValue(Object o) {
        Integer i = integer(o);
        return i == null ? null : i.longValue();
    }
}
