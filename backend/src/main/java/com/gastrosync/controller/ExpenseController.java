package com.gastrosync.controller;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
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
import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.service.AuditService;
import com.gastrosync.service.ExpenseCatalog;
import com.gastrosync.service.ExpenseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/expenses")
@Tag(name = "Muhasebe & Giderler", description = "Gider yasam dongusu: kayit -> onay -> odeme -> resmi defter")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final AuditService auditService;

    public ExpenseController(ExpenseService expenseService, AuditService auditService) {
        this.expenseService = expenseService;
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    @Operation(summary = "Giderleri listele (opsiyonel donem filtresi YYYY-MM)")
    public ResponseEntity<ApiResponse<List<ExpenseResponse>>> getAll(@RequestParam(name = "period", required = false) String period) {
        List<ExpenseResponse> list = period != null && !period.isBlank()
                ? expenseService.getExpensesByPeriod(period)
                : expenseService.getAllExpenses();
        return ResponseEntity.ok(ApiResponse.ok("Giderler", list));
    }

    @GetMapping("/search")
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    @Operation(summary = "Sayfali gider listesi (tab: pending, payable, rejected, ledger, finalized, all)")
    public ResponseEntity<ApiResponse<PageResponse<ExpenseResponse>>> search(
            @RequestParam(name = "period", required = false) String period,
            @RequestParam(name = "tab", required = false) String tab,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "sort", required = false) String sort,
            @RequestParam(name = "page", required = false) Integer page,
            @RequestParam(name = "size", required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.ok("Giderler", expenseService.search(period, tab, q, page, size, sort)));
    }

    @GetMapping("/types")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gider turleri, varsayilan KDV ve onerilen TDHP hesaplari")
    public ResponseEntity<ApiResponse<Map<String, ExpenseCatalog.ExpenseType>>> types() {
        return ResponseEntity.ok(ApiResponse.ok("Gider turleri", ExpenseCatalog.all()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    public ResponseEntity<ApiResponse<ExpenseResponse>> getById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok(expenseService.getExpenseById(id)));
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    @Operation(summary = "Giderin denetim izi ve odeme gecmisi")
    public ResponseEntity<ApiResponse<Map<String, Object>>> history(@PathVariable("id") Long id) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("expense", expenseService.getExpenseById(id));
        body.put("payments", expenseService.getPayments(id));
        body.put("auditTrail", auditService.history("EXPENSE", id));
        return ResponseEntity.ok(ApiResponse.ok("Gider gecmisi", body));
    }

    @GetMapping("/summary")
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok("Gider ozeti", expenseService.getExpenseSummary()));
    }

    @GetMapping("/category/{category}")
    @PreAuthorize("@perm.can('EXPENSE_VIEW')")
    public ResponseEntity<ApiResponse<List<ExpenseResponse>>> getByCategory(@PathVariable("category") String category) {
        return ResponseEntity.ok(ApiResponse.ok("Giderler", expenseService.getExpensesByCategory(category)));
    }

    @PostMapping
    @PreAuthorize("@perm.can('EXPENSE_CREATE')")
    @Operation(summary = "Yeni gider / harcama talebi (durum: PENDING_APPROVAL)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> create(@Valid @RequestBody ExpenseCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Gider kaydedildi ve onaya sunuldu", expenseService.createExpense(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('EXPENSE_EDIT')")
    @Operation(summary = "Bekleyen / reddedilen gideri duzelt (reddedilen kayit tekrar onaya duser)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> update(@PathVariable("id") Long id,
                                                               @Valid @RequestBody ExpenseCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Gider guncellendi", expenseService.updateExpense(id, request)));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("@perm.can('EXPENSE_APPROVE')")
    @Operation(summary = "Harcama onayi (gorevler ayriligi: kaydeden kisi onaylayamaz)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> approve(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Gider onaylandi; odeme ve faturalandirmadan sonra Mali Musavire gonderilecek",
                expenseService.approveExpense(id)));
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("@perm.can('EXPENSE_PAY')")
    @Operation(summary = "Fiili odeme kaydi (kismi odeme desteklenir)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> pay(@PathVariable("id") Long id,
                                                            @RequestBody(required = false) Map<String, Object> body) {
        BigDecimal amount = body != null && body.get("amount") != null && !body.get("amount").toString().isBlank()
                ? InventoryController.decimal(body.get("amount"), "amount") : null;
        String method = body != null && body.get("method") != null ? body.get("method").toString() : null;
        String note = body != null && body.get("note") != null ? body.get("note").toString() : null;
        return ResponseEntity.ok(ApiResponse.ok("Odeme kaydedildi", expenseService.payExpense(id, amount, method, note)));
    }

    @PutMapping("/{id}/submit")
    @PreAuthorize("@perm.can('EXPENSE_SUBMIT')")
    @Operation(summary = "Faturalandir ve Mali Musavire gonder (belge no / karsi taraf bu adimda tamamlanabilir)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> submitToAdvisor(@PathVariable("id") Long id,
                                                                        @RequestBody(required = false) Map<String, String> body) {
        String invoice = body != null ? body.get("invoiceNumber") : null;
        String counterparty = body != null ? body.get("counterparty") : null;
        String note = body != null ? body.get("note") : null;
        return ResponseEntity.ok(ApiResponse.ok("Gider Mali Musavir incelemesine gonderildi",
                expenseService.submitToAdvisor(id, invoice, counterparty, note)));
    }

    @PutMapping("/{id}/finalize")
    @PreAuthorize("@perm.can('LEDGER_DECIDE')")
    @Operation(summary = "Mali Musavir onayi: resmi deftere isle ve kesinlestir (Yonetici de yapabilir; denetim izine yazilir)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> finalizeInLedger(@PathVariable("id") Long id,
                                                                         @RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Gider resmi deftere islendi ve kesinlestirildi",
                expenseService.finalizeExpense(id, body != null ? body.get("note") : null)));
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("@perm.can('EXPENSE_APPROVE', 'LEDGER_DECIDE')")
    @Operation(summary = "Gerekceli ret (gerekce zorunlu)")
    public ResponseEntity<ApiResponse<ExpenseResponse>> reject(@PathVariable("id") Long id,
                                                               @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.ok("Gider reddedildi", expenseService.rejectExpense(id, reason)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.can('EXPENSE_DELETE')")
    @Operation(summary = "Bekleyen/reddedilmis ve odenmemis gideri arsivle")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delete(@PathVariable("id") Long id) {
        expenseService.deleteExpense(id);
        return ResponseEntity.ok(ApiResponse.ok("Gider kaydi arsivlendi", Map.of("id", id)));
    }
}
