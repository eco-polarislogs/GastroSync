package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Adisyon (masa hesabi). Masaya giden her yemek / icecek kalem olarak kaydedilir.
 * Odeme alininca kalemler satis kaydina (gelir) donusur ve recete malzemeleri stoktan duser.
 */
@Entity
@Table(name = "table_checks",
        uniqueConstraints = @UniqueConstraint(name = "uk_table_check_no", columnNames = "checkNo"),
        indexes = {
                @Index(name = "idx_table_checks_status", columnList = "status"),
                @Index(name = "idx_table_checks_closed", columnList = "closedAt")
        })
public class TableCheck {

    public static final String OPEN = "OPEN";
    public static final String PAID = "PAID";
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String checkNo;

    @Column(nullable = false)
    private Long tableId;

    @Column(nullable = false)
    private Integer tableNumber;

    @Column(nullable = false, length = 20)
    private String status = OPEN;

    private Integer guestCount = 1;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(precision = 12, scale = 2)
    private BigDecimal vatAmount = BigDecimal.ZERO;

    @Column(length = 20)
    private String paymentMethod;

    @Column(precision = 12, scale = 2)
    private BigDecimal receivedAmount;

    @Column(length = 100)
    private String openedBy;

    private LocalDateTime openedAt;

    @Column(length = 100)
    private String closedBy;

    private LocalDateTime closedAt;

    @Column(length = 300)
    private String note;

    @Column(length = 300)
    private String cancelReason;

    /** Onaylanmis yuzde indirim (1-100) */
    @Column(precision = 5, scale = 2)
    private BigDecimal discountPercent;

    /** Onaylanmis sabit tutar indirimi (TL) */
    @Column(precision = 12, scale = 2)
    private BigDecimal discountValue;

    /** Tahsilatta uygulanan indirim tutari (kesinlesmis) */
    @Column(precision = 12, scale = 2)
    private BigDecimal discountAmount;

    /** Tahsilatta ikram edilen kalemlerin liste fiyati toplami */
    @Column(precision = 12, scale = 2)
    private BigDecimal compAmount;

    @Column(length = 200)
    private String discountReason;

    /** Indirimi onaylayan (Mudur) */
    @Column(length = 100)
    private String discountBy;

    @PrePersist
    protected void onCreate() {
        if (openedAt == null) openedAt = LocalDateTime.now();
        if (status == null) status = OPEN;
    }

    public TableCheck() {}

    public boolean isOpen() { return OPEN.equals(status); }

    public Long getId() { return id; }
    public String getCheckNo() { return checkNo; }
    public void setCheckNo(String checkNo) { this.checkNo = checkNo; }
    public Long getTableId() { return tableId; }
    public void setTableId(Long tableId) { this.tableId = tableId; }
    public Integer getTableNumber() { return tableNumber; }
    public void setTableNumber(Integer tableNumber) { this.tableNumber = tableNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getGuestCount() { return guestCount; }
    public void setGuestCount(Integer guestCount) { this.guestCount = guestCount; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BigDecimal getVatAmount() { return vatAmount; }
    public void setVatAmount(BigDecimal vatAmount) { this.vatAmount = vatAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public BigDecimal getReceivedAmount() { return receivedAmount; }
    public void setReceivedAmount(BigDecimal receivedAmount) { this.receivedAmount = receivedAmount; }
    public String getOpenedBy() { return openedBy; }
    public void setOpenedBy(String openedBy) { this.openedBy = openedBy; }
    public LocalDateTime getOpenedAt() { return openedAt; }
    public void setOpenedAt(LocalDateTime openedAt) { this.openedAt = openedAt; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    public BigDecimal getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(BigDecimal discountPercent) { this.discountPercent = discountPercent; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public BigDecimal getCompAmount() { return compAmount; }
    public void setCompAmount(BigDecimal compAmount) { this.compAmount = compAmount; }
    public String getDiscountReason() { return discountReason; }
    public void setDiscountReason(String discountReason) { this.discountReason = discountReason; }
    public String getDiscountBy() { return discountBy; }
    public void setDiscountBy(String discountBy) { this.discountBy = discountBy; }
    public boolean hasDiscount() {
        return (discountPercent != null && discountPercent.signum() > 0) || (discountValue != null && discountValue.signum() > 0);
    }
}
