package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.Expense;
import com.gastrosync.service.ExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/expenses")
@Tag(name = "Muhasebe & Genel Giderler", description = "Sabit ve değişken restoran genel giderleri yönetimi")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    @Operation(summary = "Tüm giderleri listele")
    public ResponseEntity<ApiResponse<List<Expense>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Giderler başarıyla listelendi", expenseService.getAllExpenses()));
    }

    @GetMapping("/summary")
    @Operation(summary = "Sabit, değişken ve genel toplam gider özetini getir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Gider özeti başarıyla hesaplandı", expenseService.getExpenseSummary()));
    }

    @GetMapping("/category/{category}")
    @Operation(summary = "Kategoriye göre giderleri filtrele (FIXED veya VARIABLE)")
    public ResponseEntity<ApiResponse<List<Expense>>> getByCategory(@PathVariable("category") String category) {
        return ResponseEntity.ok(ApiResponse.ok("Giderler listelendi", expenseService.getExpensesByCategory(category)));
    }

    @PostMapping
    @Operation(summary = "Yeni gider kaydı ekle")
    public ResponseEntity<ApiResponse<Expense>> create(@RequestBody Expense expense) {
        Expense saved = expenseService.saveExpense(expense);
        return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla kaydedildi", saved));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mevcut gider kaydını güncelle")
    public ResponseEntity<ApiResponse<Expense>> update(@PathVariable("id") Long id, @RequestBody Expense updated) {
        return expenseService.getExpenseById(id).map(e -> {
            if (updated.getTitle() != null) e.setTitle(updated.getTitle());
            if (updated.getCategory() != null) e.setCategory(updated.getCategory());
            if (updated.getSubType() != null) e.setSubType(updated.getSubType());
            if (updated.getAmount() != null) e.setAmount(updated.getAmount());
            if (updated.getPeriod() != null) e.setPeriod(updated.getPeriod());
            if (updated.getExpenseDate() != null) e.setExpenseDate(updated.getExpenseDate());
            if (updated.getNote() != null) e.setNote(updated.getNote());
            if (updated.getIsOwnedProperty() != null) e.setIsOwnedProperty(updated.getIsOwnedProperty());
            if (updated.getPaidByCashier() != null) e.setPaidByCashier(updated.getPaidByCashier());
            if (updated.getRecordedInLedger() != null) e.setRecordedInLedger(updated.getRecordedInLedger());
            if (updated.getSentToAdvisor() != null) e.setSentToAdvisor(updated.getSentToAdvisor());
            if (updated.getStatus() != null) e.setStatus(updated.getStatus());
            if (updated.getPaymentStatus() != null) e.setPaymentStatus(updated.getPaymentStatus());
            if (updated.getRejectionReason() != null) e.setRejectionReason(updated.getRejectionReason());
            if (updated.getDueDate() != null) e.setDueDate(updated.getDueDate());
            if (updated.getInvoiceNumber() != null) e.setInvoiceNumber(updated.getInvoiceNumber());
            if (updated.getCounterparty() != null) e.setCounterparty(updated.getCounterparty());
            Expense saved = expenseService.saveExpense(e);
            return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla güncellendi", saved));
        }).orElse(ResponseEntity.status(404).body(ApiResponse.error("Gider bulunamadı: " + id)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Gider kaydını sil")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable("id") Long id) {
        expenseService.deleteExpense(id);
        return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla silindi", null));
    }
}
