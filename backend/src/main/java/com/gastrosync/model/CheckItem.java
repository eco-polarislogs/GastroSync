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
 * Adisyon kalemi: hangi masaya hangi yemek / icecekten kac adet gittigi.
 * Mutfak akisi: ORDERED (mutfaga iletildi) -> PREPARING -> READY -> SERVED. Iptal gerekcelidir.
 */
@Entity
@Table(name = "check_items", indexes = {
        @Index(name = "idx_check_items_check", columnList = "checkId"),
        @Index(name = "idx_check_items_status", columnList = "status")
})
public class CheckItem {

    public static final String ORDERED = "ORDERED";
    public static final String PREPARING = "PREPARING";
    public static final String READY = "READY";
    public static final String SERVED = "SERVED";
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long checkId;

    @Column(nullable = false)
    private Integer tableNumber;

    @Column(nullable = false)
    private Long recipeId;

    @Column(nullable = false, length = 150)
    private String productName;

    @Column(length = 80)
    private String category;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal lineTotal = BigDecimal.ZERO;

    @Column(length = 200)
    private String note;

    @Column(nullable = false, length = 20)
    private String status = ORDERED;

    @Column(length = 100)
    private String addedBy;

    private LocalDateTime addedAt;

    private LocalDateTime statusChangedAt;

    @Column(length = 100)
    private String statusChangedBy;

    @Column(length = 200)
    private String cancelReason;

    /** Ikram: kalem ucretsiz servis edilir (lineTotal 0), stok ve maliyet yine islenir */
    private Boolean comp;

    @Column(length = 200)
    private String compReason;

    /** Ikrami onaylayan (Mudur) */
    @Column(length = 100)
    private String compBy;

    @PrePersist
    protected void onCreate() {
        if (addedAt == null) addedAt = LocalDateTime.now();
        if (statusChangedAt == null) statusChangedAt = addedAt;
        if (status == null) status = ORDERED;
    }

    public CheckItem() {}

    public boolean isActive() { return !CANCELLED.equals(status); }

    public Long getId() { return id; }
    public Long getCheckId() { return checkId; }
    public void setCheckId(Long checkId) { this.checkId = checkId; }
    public Integer getTableNumber() { return tableNumber; }
    public void setTableNumber(Integer tableNumber) { this.tableNumber = tableNumber; }
    public Long getRecipeId() { return recipeId; }
    public void setRecipeId(Long recipeId) { this.recipeId = recipeId; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal lineTotal) { this.lineTotal = lineTotal; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAddedBy() { return addedBy; }
    public void setAddedBy(String addedBy) { this.addedBy = addedBy; }
    public LocalDateTime getAddedAt() { return addedAt; }
    public void setAddedAt(LocalDateTime addedAt) { this.addedAt = addedAt; }
    public LocalDateTime getStatusChangedAt() { return statusChangedAt; }
    public void setStatusChangedAt(LocalDateTime statusChangedAt) { this.statusChangedAt = statusChangedAt; }
    public String getStatusChangedBy() { return statusChangedBy; }
    public void setStatusChangedBy(String statusChangedBy) { this.statusChangedBy = statusChangedBy; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    public boolean isComp() { return Boolean.TRUE.equals(comp); }
    public Boolean getComp() { return comp; }
    public void setComp(Boolean comp) { this.comp = comp; }
    public String getCompReason() { return compReason; }
    public void setCompReason(String compReason) { this.compReason = compReason; }
    public String getCompBy() { return compBy; }
    public void setCompBy(String compBy) { this.compBy = compBy; }
    /** Liste fiyatiyla kalem degeri (ikramda da gosterilir) */
    public java.math.BigDecimal getListTotal() {
        return (unitPrice == null ? java.math.BigDecimal.ZERO : unitPrice)
                .multiply(java.math.BigDecimal.valueOf(quantity == null ? 1 : quantity))
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
