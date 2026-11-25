package com.gastrosync.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * Isletme gideri / tedarikci faturasi.
 *
 * Durum makinesi (ExpenseService tarafindan zorlanir):
 *   PENDING_APPROVAL --(Mudur/Muhasebe onayi, gorevler ayriligi)--> APPROVED
 *   APPROVED --(yalnizca Mali Musavir)--> FINALIZED   [KILITLI: degistirilemez/silinemez]
 *   PENDING_APPROVAL | APPROVED --(gerekceli ret)--> REJECTED --(duzeltme)--> PENDING_APPROVAL
 *
 * Odeme (kasa/banka cikisi) ayri bir islemdir: ExpensePayment kayitlari paidAmount'u olusturur.
 * Tutar (amount) KDV DAHIL brut tutardir; vatRate ile indirilecek KDV hesaplanir.
 */
@Entity
@Table(
    name = "expenses",
    indexes = {
        @Index(name = "idx_expenses_period", columnList = "period"),
        @Index(name = "idx_expenses_category_subtype", columnList = "category, subType"),
        @Index(name = "idx_expenses_status", columnList = "status"),
        @Index(name = "idx_expenses_payment_status", columnList = "paymentStatus"),
        @Index(name = "idx_expenses_date", columnList = "expenseDate DESC"),
        @Index(name = "idx_expenses_is_deleted", columnList = "is_deleted")
    }
)
@SQLDelete(sql = "UPDATE expenses SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("is_deleted = false")
public class Expense extends BaseAuditableEntity {

    public static final String STATUS_PENDING = "PENDING_APPROVAL";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_FINALIZED = "FINALIZED";
    public static final String STATUS_REJECTED = "REJECTED";

    public static final String PAYMENT_UNPAID = "UNPAID";
    public static final String PAYMENT_PARTIAL = "PARTIAL";
    public static final String PAYMENT_PAID = "PAID";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String category; // FIXED (Sabit) veya VARIABLE (Degisken)

    @Column(nullable = false)
    private String subType;

    /** KDV dahil brut tutar */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Muhasebe donemi YYYY-MM; her zaman expenseDate'ten turetilir */
    @Column(nullable = false)
    private String period;

    @Column(nullable = false)
    private LocalDate expenseDate;

    private String recordedBy;
    private String note;

    private Boolean isOwnedProperty = false;
    private Boolean paidByCashier = false;
    private Boolean recordedInLedger = false;
    private Boolean sentToAdvisor = false;

    private String status = STATUS_PENDING;
    private String paymentStatus = PAYMENT_UNPAID;
    private String rejectionReason;
    private LocalDate dueDate;
    private String invoiceNumber;
    private String counterparty;

    // ── Vergi & odeme ───────────────────────────────────────────
    @Column(precision = 5, scale = 2)
    private BigDecimal vatRate;

    @Column(precision = 12, scale = 2)
    private BigDecimal paidAmount;

    private String lastPaymentMethod;

    // ── Onay zinciri (kim / ne zaman) ───────────────────────────
    private String approvedBy;
    private LocalDateTime approvedAt;
    private String finalizedBy;
    private LocalDateTime finalizedAt;
    private String rejectedBy;
    private LocalDateTime rejectedAt;
    /** Muhasebenin belgeyi tamamlayip Mali Musavire gonderdigi kisi / an */
    private String submittedBy;
    private LocalDateTime submittedAt;
    /** Mali Musavirin (veya Yoneticinin) deftere isleme notu */
    @Column(length = 500)
    private String advisorNote;

    // ── Hammadde alim talebi baglantisi ─────────────────────────
    private Long inventoryItemId;

    @Column(precision = 12, scale = 3)
    private BigDecimal purchaseQuantity;

    /** Depoda fiilen teslim alinan miktar (mal kabul ile artar) */
    @Column(precision = 12, scale = 3)
    private BigDecimal deliveredQuantity;

    @PrePersist
    protected void onCreate() {
        if (this.expenseDate == null) {
            this.expenseDate = LocalDate.now();
        }
        this.period = periodOf(this.expenseDate);
        if (this.status == null || this.status.isBlank()) {
            this.status = STATUS_PENDING;
        }
        if (this.paidAmount == null) {
            this.paidAmount = BigDecimal.ZERO;
        }
        refreshPaymentStatus();
    }

    @PreUpdate
    protected void onUpdate() {
        if (this.expenseDate != null) {
            this.period = periodOf(this.expenseDate);
        }
    }

    public static String periodOf(LocalDate date) {
        LocalDate d = date != null ? date : LocalDate.now();
        return d.getYear() + "-" + String.format("%02d", d.getMonthValue());
    }

    /** Odenen tutara gore odeme durumunu ve eski uyumluluk bayragini gunceller */
    public void refreshPaymentStatus() {
        BigDecimal paid = getPaidAmount();
        BigDecimal total = amount != null ? amount : BigDecimal.ZERO;
        if (paid.signum() <= 0) {
            this.paymentStatus = PAYMENT_UNPAID;
        } else if (paid.compareTo(total) >= 0) {
            this.paymentStatus = PAYMENT_PAID;
        } else {
            this.paymentStatus = PAYMENT_PARTIAL;
        }
        this.paidByCashier = PAYMENT_PAID.equals(this.paymentStatus);
    }

    // ── Turetilmis tutarlar ─────────────────────────────────────
    public BigDecimal getVatAmount() {
        BigDecimal rate = vatRate != null ? vatRate : BigDecimal.ZERO;
        if (amount == null || rate.signum() <= 0) return BigDecimal.ZERO.setScale(2);
        return amount.multiply(rate).divide(rate.add(new BigDecimal("100")), 2, RoundingMode.HALF_UP);
    }

    public BigDecimal getNetAmount() {
        if (amount == null) return BigDecimal.ZERO.setScale(2);
        return amount.subtract(getVatAmount()).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal getRemainingAmount() {
        if (amount == null) return BigDecimal.ZERO.setScale(2);
        BigDecimal remaining = amount.subtract(getPaidAmount());
        return remaining.signum() < 0 ? BigDecimal.ZERO.setScale(2) : remaining.setScale(2, RoundingMode.HALF_UP);
    }

    public boolean isFinalized() { return STATUS_FINALIZED.equalsIgnoreCase(status); }

    public Expense() {}

    public Expense(String title, String category, String subType, BigDecimal amount, String period, LocalDate expenseDate, String recordedBy, String note) {
        this.title = title;
        this.category = category;
        this.subType = subType;
        this.amount = amount;
        this.expenseDate = expenseDate != null ? expenseDate : LocalDate.now();
        this.period = period != null ? period : periodOf(this.expenseDate);
        this.recordedBy = recordedBy;
        this.note = note;
        this.isOwnedProperty = false;
        this.recordedInLedger = false;
        this.paidAmount = BigDecimal.ZERO;
    }

    public Expense(String title, String category, String subType, BigDecimal amount, String period, LocalDate expenseDate, String recordedBy, String note, Boolean isOwnedProperty, Boolean paidByCashier, Boolean recordedInLedger) {
        this(title, category, subType, amount, period, expenseDate, recordedBy, note);
        this.isOwnedProperty = isOwnedProperty != null ? isOwnedProperty : false;
        this.recordedInLedger = recordedInLedger != null ? recordedInLedger : false;
        if (Boolean.TRUE.equals(paidByCashier) && amount != null) {
            this.paidAmount = amount;
        }
    }

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
    public BigDecimal getVatRate() { return vatRate != null ? vatRate : BigDecimal.ZERO; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public BigDecimal getPaidAmount() { return paidAmount != null ? paidAmount : BigDecimal.ZERO; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
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
    public BigDecimal getDeliveredQuantity() { return deliveredQuantity != null ? deliveredQuantity : BigDecimal.ZERO; }
    public void setDeliveredQuantity(BigDecimal deliveredQuantity) { this.deliveredQuantity = deliveredQuantity; }

    public String getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(String submittedBy) { this.submittedBy = submittedBy; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public String getAdvisorNote() { return advisorNote; }
    public void setAdvisorNote(String advisorNote) { this.advisorNote = advisorNote; }
}
