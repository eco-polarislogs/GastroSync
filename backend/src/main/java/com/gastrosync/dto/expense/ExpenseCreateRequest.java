package com.gastrosync.dto.expense;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request DTO for creating or updating an Expense record.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. STRICT INPUT VALIDATION:
 *    - All validation rules (@NotBlank, @NotNull, @DecimalMin) live on this DTO.
 *    - When the controller receives a request annotated with @Valid, Spring's
 *      MethodArgumentNotValidException fires BEFORE any service method runs,
 *      protecting the domain layer from invalid states (Fail-Fast principle).
 *
 * 2. SEPARATION OF CONCERNS:
 *    - Domain entities (Expense) should never validate HTTP input representations.
 *    - This DTO acts as an external contract; internal entity structure can evolve
 *      without breaking API clients.
 */
public class ExpenseCreateRequest {

    @NotBlank(message = "Gider başlığı zorunludur")
    @Size(min = 3, max = 150, message = "Başlık 3 ile 150 karakter arasında olmalıdır")
    private String title;

    @NotBlank(message = "Gider kategorisi zorunludur (FIXED veya VARIABLE)")
    private String category;

    @NotBlank(message = "Gider alt tipi zorunludur (örn: RENT, LABOR, ELECTRICITY)")
    private String subType;

    @NotNull(message = "Gider tutarı zorunludur")
    @DecimalMin(value = "0.01", message = "Gider tutarı 0'dan büyük olmalıdır")
    private BigDecimal amount;

    @NotBlank(message = "Muhasebe dönemi zorunludur (örn: 2026-10)")
    private String period;

    private LocalDate expenseDate;

    private String note;

    private Boolean isOwnedProperty = false;

    private Boolean paidByCashier = false;

    private String paymentStatus = "UNPAID";

    private LocalDate dueDate;

    private String invoiceNumber;

    private String counterparty;

    public ExpenseCreateRequest() {}

    // Getters and Setters
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSubType() { return subType; }
    public void setSubType(String subType) { this.subType = subType; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }

    public LocalDate getExpenseDate() { return expenseDate; }
    public void setExpenseDate(LocalDate expenseDate) { this.expenseDate = expenseDate; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Boolean getIsOwnedProperty() { return isOwnedProperty; }
    public void setIsOwnedProperty(Boolean isOwnedProperty) { this.isOwnedProperty = isOwnedProperty; }

    public Boolean getPaidByCashier() { return paidByCashier; }
    public void setPaidByCashier(Boolean paidByCashier) { this.paidByCashier = paidByCashier; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getCounterparty() { return counterparty; }
    public void setCounterparty(String counterparty) { this.counterparty = counterparty; }
}
