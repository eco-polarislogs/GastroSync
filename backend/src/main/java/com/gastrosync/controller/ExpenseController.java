package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.service.ExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for Expense Management.
 *
 * Enforces strict DTO contracts, input validation (@Valid), and Role-Based Access Control (@PreAuthorize).
 */
@RestController
@RequestMapping("/api/expenses")
@Tag(name = "Muhasebe & Genel Giderler", description = "Sabit ve değişken restoran genel giderleri yönetimi")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Tüm giderleri listele")
    public ResponseEntity<ApiResponse<List<ExpenseResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Giderler başarıyla listelendi", expenseService.getAllExpenses()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "ID ile gider kaydı getir")
    public ResponseEntity<ApiResponse<ExpenseResponse>> getById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok(expenseService.getExpenseById(id)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Sabit, değişken ve genel toplam gider özetini getir")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Gider özeti başarıyla hesaplandı", expenseService.getExpenseSummary()));
    }

    @GetMapping("/category/{category}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Kategoriye göre giderleri filtrele (FIXED veya VARIABLE)")
    public ResponseEntity<ApiResponse<List<ExpenseResponse>>> getByCategory(@PathVariable("category") String category) {
        return ResponseEntity.ok(ApiResponse.ok("Giderler listelendi", expenseService.getExpensesByCategory(category)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'MANAGER', 'CHEF', 'WAREHOUSE')")
    @Operation(summary = "Yeni gider / harcama talebi ekle (İlk Durum: PENDING_APPROVAL)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> create(@Valid @RequestBody ExpenseCreateRequest request) {
        ExpenseResponse saved = expenseService.createExpense(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Gider başarıyla kaydedildi", saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    @Operation(summary = "Mevcut gider kaydını güncelle")
    public ResponseEntity<ApiResponse<ExpenseResponse>> update(
            @PathVariable("id") Long id,
            @Valid @RequestBody ExpenseCreateRequest request) {
        ExpenseResponse updated = expenseService.updateExpense(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla güncellendi", updated));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT')")
    @Operation(summary = "Gider onaylama (Yönetici / Muhasebeci -> APPROVED)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> approve(@PathVariable("id") Long id) {
        ExpenseResponse approved = expenseService.approveExpense(id);
        return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla onaylandı ve kasadan ödendi", approved));
    }

    @PutMapping("/{id}/finalize")
    @PreAuthorize("hasAnyRole('ADMIN', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Gideri resmi deftere işleme ve kesinleştirme (Mali Müşavir SMMM -> FINALIZED)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> finalizeInLedger(@PathVariable("id") Long id) {
        ExpenseResponse finalized = expenseService.finalizeExpense(id);
        return ResponseEntity.ok(ApiResponse.ok("Gider Mali Müşavir tarafından resmi deftere işlendi ve kesinleştirildi", finalized));
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR')")
    @Operation(summary = "Gider reddetme (Gerekçeli)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> reject(
            @PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        ExpenseResponse rejected = expenseService.rejectExpense(id, reason);
        return ResponseEntity.ok(ApiResponse.ok("Gider başarıyla reddedildi", rejected));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Gider kaydını sil (Soft Delete)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delete(@PathVariable("id") Long id) {
        expenseService.deleteExpense(id);
        return ResponseEntity.ok(ApiResponse.ok("Gider kaydı başarıyla silindi (Soft Delete)", Map.of("id", id)));
    }
}
