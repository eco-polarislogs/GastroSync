package com.gastrosync.dto.expense;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Gider olusturma / duzeltme istegi.
 * status, onay ve defter alanlari istemciden ALINMAZ; durum gecisleri ayri uc noktalarla yapilir.
 * period her zaman expenseDate'ten turetilir.
 */
public class ExpenseCreateRequest {

    @NotBlank(message = "Gider basligi zorunludur")
    @Size(min = 3, max = 150, message = "Baslik 3 ile 150 karakter arasinda olmalidir")
    private String title;

    @NotBlank(message = "Gider kategorisi zorunludur (FIXED veya VARIABLE)")
    private String category;

    @NotBlank(message = "Gider alt tipi zorunludur (orn: RENT, LABOR, ELECTRICITY)")
    private String subType;

    @NotNull(message = "Gider tutari zorunludur")
    @DecimalMin(value = "0.01", message = "Gider tutari 0'dan buyuk olmalidir")
    @DecimalMax(value = "99999999.99", message = "Gider tutari cok yuksek")
    private BigDecimal amount;

    /** Geriye donuk uyumluluk icin kabul edilir; dikkate alinmaz (expenseDate'ten turetilir) */
    private String period;

    private LocalDate expenseDate;

    @Size(max = 500)
    private String note;

    private Boolean isOwnedProperty = false;

    /** Kayit aninda pesin odeme: PAID | PARTIAL | UNPAID (yalnizca kasa yetkilileri) */
    private String paymentStatus = "UNPAID";
    private BigDecimal paidAmount;
    private String paymentMethod;
    /** Eski istemci uyumlulugu */
    private Boolean paidByCashier = false;

    private LocalDate dueDate;

    @Size(max = 60)
    private String invoiceNumber;

    @Size(max = 150)
    private String counterparty;

    /** KDV orani (%): 0, 1, 10, 20 */
    private BigDecimal vatRate;

    private Long inventoryItemId;
    private BigDecimal purchaseQuantity;

    public ExpenseCreateRequest() {}

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
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public Boolean getPaidByCashier() { return paidByCashier; }
    public void setPaidByCashier(Boolean paidByCashier) { this.paidByCashier = paidByCashier; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public String getCounterparty() { return counterparty; }
    public void setCounterparty(String counterparty) { this.counterparty = counterparty; }
    public BigDecimal getVatRate() { return vatRate; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public Long getInventoryItemId() { return inventoryItemId; }
    public void setInventoryItemId(Long inventoryItemId) { this.inventoryItemId = inventoryItemId; }
    public BigDecimal getPurchaseQuantity() { return purchaseQuantity; }
    public void setPurchaseQuantity(BigDecimal purchaseQuantity) { this.purchaseQuantity = purchaseQuantity; }
}
