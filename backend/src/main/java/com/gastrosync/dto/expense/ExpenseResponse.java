package com.gastrosync.dto.expense;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class ExpenseResponse {

    private Long id;
    private String title;
    private String category;
    private String subType;
    private BigDecimal amount;
    private String period;
    private LocalDate expenseDate;
    private String recordedBy;
    private String note;
    private Boolean isOwnedProperty;
    private Boolean paidByCashier;
    private Boolean recordedInLedger;
    private Boolean sentToAdvisor;
    private String status;
    private String paymentStatus;
    private String rejectionReason;
    private LocalDate dueDate;
    private String invoiceNumber;
    private String counterparty;
    private BigDecimal vatRate;
    private BigDecimal vatAmount;
    private BigDecimal netAmount;
    private BigDecimal paidAmount;
    private BigDecimal remainingAmount;
    private String lastPaymentMethod;
    private String approvedBy;
    private LocalDateTime approvedAt;
    private String finalizedBy;
    private LocalDateTime finalizedAt;
    private String rejectedBy;
    private LocalDateTime rejectedAt;
    private String submittedBy;
    private LocalDateTime submittedAt;
    private String advisorNote;
    private Long inventoryItemId;
    private BigDecimal purchaseQuantity;
    private BigDecimal deliveredQuantity;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String lastModifiedBy;

    public ExpenseResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
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
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Boolean getIsOwnedProperty() { return isOwnedProperty; }
    public void setIsOwnedProperty(Boolean isOwnedProperty) { this.isOwnedProperty = isOwnedProperty; }
    public Boolean getPaidByCashier() { return paidByCashier; }
    public void setPaidByCashier(Boolean paidByCashier) { this.paidByCashier = paidByCashier; }
    public Boolean getRecordedInLedger() { return recordedInLedger; }
    public void setRecordedInLedger(Boolean recordedInLedger) { this.recordedInLedger = recordedInLedger; }
    public Boolean getSentToAdvisor() { return sentToAdvisor; }
    public void setSentToAdvisor(Boolean sentToAdvisor) { this.sentToAdvisor = sentToAdvisor; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public String getCounterparty() { return counterparty; }
    public void setCounterparty(String counterparty) { this.counterparty = counterparty; }
    public BigDecimal getVatRate() { return vatRate; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public BigDecimal getVatAmount() { return vatAmount; }
    public void setVatAmount(BigDecimal vatAmount) { this.vatAmount = vatAmount; }
    public BigDecimal getNetAmount() { return netAmount; }
    public void setNetAmount(BigDecimal netAmount) { this.netAmount = netAmount; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public String getLastPaymentMethod() { return lastPaymentMethod; }
    public void setLastPaymentMethod(String lastPaymentMethod) { this.lastPaymentMethod = lastPaymentMethod; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public String getFinalizedBy() { return finalizedBy; }
    public void setFinalizedBy(String finalizedBy) { this.finalizedBy = finalizedBy; }
    public LocalDateTime getFinalizedAt() { return finalizedAt; }
    public void setFinalizedAt(LocalDateTime finalizedAt) { this.finalizedAt = finalizedAt; }
    public String getRejectedBy() { return rejectedBy; }
    public void setRejectedBy(String rejectedBy) { this.rejectedBy = rejectedBy; }
    public LocalDateTime getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(LocalDateTime rejectedAt) { this.rejectedAt = rejectedAt; }
    public Long getInventoryItemId() { return inventoryItemId; }
    public void setInventoryItemId(Long inventoryItemId) { this.inventoryItemId = inventoryItemId; }
    public BigDecimal getPurchaseQuantity() { return purchaseQuantity; }
    public void setPurchaseQuantity(BigDecimal purchaseQuantity) { this.purchaseQuantity = purchaseQuantity; }
    public BigDecimal getDeliveredQuantity() { return deliveredQuantity; }
    public void setDeliveredQuantity(BigDecimal deliveredQuantity) { this.deliveredQuantity = deliveredQuantity; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getLastModifiedBy() { return lastModifiedBy; }
    public void setLastModifiedBy(String lastModifiedBy) { this.lastModifiedBy = lastModifiedBy; }

    public String getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(String submittedBy) { this.submittedBy = submittedBy; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public String getAdvisorNote() { return advisorNote; }
    public void setAdvisorNote(String advisorNote) { this.advisorNote = advisorNote; }
}
