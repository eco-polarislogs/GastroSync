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

/**
 * POS satis satiri.
 *
 * Fiyat istemciden ALINMAZ: satis fiyati, KDV orani ve porsiyon maliyeti satis anindaki
 * recete/stok degerlerinden sunucuda hesaplanip bu kayda "dondurulur" (snapshot).
 * Satislar silinmez; yetkili kisi gerekceli IPTAL (VOIDED) yapar ve stok ters kayitla geri alinir.
 */
@Entity
@Table(
    name = "sales_records",
    indexes = {
        @Index(name = "idx_sales_sold_at", columnList = "soldAt"),
        @Index(name = "idx_sales_order_no", columnList = "orderNo"),
        @Index(name = "idx_sales_status", columnList = "status")
    }
)
public class SalesRecord {

    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_VOIDED = "VOIDED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String orderNo;

    @Column(nullable = false)
    private String time;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    /** KDV dahil birim satis fiyati */
    @Column(nullable = false)
    private BigDecimal unitPrice;

    /** KDV dahil satir toplami */
    @Column(nullable = false)
    private BigDecimal totalPrice;

    @Column(nullable = false)
    private String tableNo;

    /** CASH, CREDIT_CARD, MEAL_CARD */
    @Column(nullable = false)
    private String paymentMethod;

    private LocalDateTime soldAt;
    private Long recipeId;

    /** Satis anindaki porsiyon maliyeti (COGS snapshot) */
    @Column(precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalCost;

    @Column(precision = 5, scale = 2)
    private BigDecimal vatRate;

    @Column(precision = 12, scale = 2)
    private BigDecimal vatAmount;

    private String status;
    private String voidReason;
    private String voidedBy;
    private LocalDateTime voidedAt;
    private String recordedBy;

    /** Bu satira dusen indirim (adisyon indirimi oransal dagitilir) veya ikramda liste fiyati */
    @Column(precision = 12, scale = 2)
    private BigDecimal discountAmount;

    /** Ikram satiri: gelir 0, maliyet (stok tuketimi) yine kayitlidir */
    private Boolean comp;

    @PrePersist
    protected void onCreate() {
        if (soldAt == null) soldAt = LocalDateTime.now();
        if (status == null) status = STATUS_COMPLETED;
    }

    public SalesRecord() {}

    public SalesRecord(String orderNo, String time, String productName, Integer quantity,
                       BigDecimal unitPrice, BigDecimal totalPrice, String tableNo, String paymentMethod) {
        this.orderNo = orderNo;
        this.time = time;
        this.productName = productName;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.totalPrice = totalPrice;
        this.tableNo = tableNo;
        this.paymentMethod = paymentMethod;
    }

    public boolean isVoided() { return STATUS_VOIDED.equalsIgnoreCase(status); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public void setTotalPrice(BigDecimal totalPrice) { this.totalPrice = totalPrice; }
    public String getTableNo() { return tableNo; }
    public void setTableNo(String tableNo) { this.tableNo = tableNo; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public LocalDateTime getSoldAt() { return soldAt; }
    public void setSoldAt(LocalDateTime soldAt) { this.soldAt = soldAt; }
    public Long getRecipeId() { return recipeId; }
    public void setRecipeId(Long recipeId) { this.recipeId = recipeId; }
    public BigDecimal getUnitCost() { return unitCost != null ? unitCost : BigDecimal.ZERO; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
    public BigDecimal getTotalCost() { return totalCost != null ? totalCost : BigDecimal.ZERO; }
    public void setTotalCost(BigDecimal totalCost) { this.totalCost = totalCost; }
    public BigDecimal getVatRate() { return vatRate != null ? vatRate : BigDecimal.ZERO; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public BigDecimal getVatAmount() { return vatAmount != null ? vatAmount : BigDecimal.ZERO; }
    public void setVatAmount(BigDecimal vatAmount) { this.vatAmount = vatAmount; }
    public String getStatus() { return status != null ? status : STATUS_COMPLETED; }
    public void setStatus(String status) { this.status = status; }
    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String voidReason) { this.voidReason = voidReason; }
    public String getVoidedBy() { return voidedBy; }
    public void setVoidedBy(String voidedBy) { this.voidedBy = voidedBy; }
    public LocalDateTime getVoidedAt() { return voidedAt; }
    public void setVoidedAt(LocalDateTime voidedAt) { this.voidedAt = voidedAt; }
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public Boolean getComp() { return comp; }
    public void setComp(Boolean comp) { this.comp = comp; }
}
