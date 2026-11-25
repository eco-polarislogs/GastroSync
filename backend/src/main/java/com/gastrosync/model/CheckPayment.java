package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Adisyon tahsilat satiri (parcali odeme / hesap bolme).
 * Bir adisyon birden cok yontemle (nakit + kart + yemek karti) ve birden cok kisiye bolunerek odenebilir.
 * Odemeler kalan tutari kapattiginda adisyon kapanir ve satis kaydi olusur. Kapanmis adisyonun odemesi degistirilemez.
 * Raporlar karisik (MIXED) odenen satislari bu satirlarin oranina gore yontemlere dagitir.
 */
@Entity
@Table(name = "check_payments", indexes = {
        @Index(name = "idx_check_payment_check", columnList = "check_id"),
        @Index(name = "idx_check_payment_check_no", columnList = "check_no"),
        @Index(name = "idx_check_payment_paid_at", columnList = "paid_at")
})
public class CheckPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "check_id", nullable = false)
    private Long checkId;

    @Column(name = "check_no", nullable = false, length = 40)
    private String checkNo;

    @Column(nullable = false, length = 20)
    private String method;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "received_amount", precision = 14, scale = 2)
    private BigDecimal receivedAmount;

    @Column(name = "change_amount", precision = 14, scale = 2)
    private BigDecimal changeAmount;

    /** Kalem bazli bolmede odenen kalemlerin kimlikleri (virgulle ayrilmis) */
    @Column(name = "item_ids", length = 1000)
    private String itemIds;

    /** Kisi basi bolmede etiket (or. "1/3") veya kisa not */
    @Column(length = 120)
    private String label;

    @Column(name = "paid_by", length = 120)
    private String paidBy;

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt;

    @Column(nullable = false)
    private boolean voided = false;

    @Column(name = "voided_by", length = 120)
    private String voidedBy;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "void_reason", length = 300)
    private String voidReason;

    public Long getId() { return id; }
    public Long getCheckId() { return checkId; }
    public void setCheckId(Long checkId) { this.checkId = checkId; }
    public String getCheckNo() { return checkNo; }
    public void setCheckNo(String checkNo) { this.checkNo = checkNo; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getReceivedAmount() { return receivedAmount; }
    public void setReceivedAmount(BigDecimal receivedAmount) { this.receivedAmount = receivedAmount; }
    public BigDecimal getChangeAmount() { return changeAmount; }
    public void setChangeAmount(BigDecimal changeAmount) { this.changeAmount = changeAmount; }
    public String getItemIds() { return itemIds; }
    public void setItemIds(String itemIds) { this.itemIds = itemIds; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getPaidBy() { return paidBy; }
    public void setPaidBy(String paidBy) { this.paidBy = paidBy; }
    public LocalDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }
    public boolean isVoided() { return voided; }
    public void setVoided(boolean voided) { this.voided = voided; }
    public String getVoidedBy() { return voidedBy; }
    public void setVoidedBy(String voidedBy) { this.voidedBy = voidedBy; }
    public LocalDateTime getVoidedAt() { return voidedAt; }
    public void setVoidedAt(LocalDateTime voidedAt) { this.voidedAt = voidedAt; }
    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String voidReason) { this.voidReason = voidReason; }
}
