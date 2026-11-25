package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Degistirilemez stok hareketi (stok defteri satiri).
 * Stok miktari yalnizca bu hareketler uzerinden degisir; her kayitta islem sonrasi bakiye tutulur.
 *
 * Tipler:
 *  INBOUND        Mal kabul / acilis stogu
 *  OUTBOUND_SALE  Receteden satis tuketimi (COGS)
 *  SALE_REVERSAL  Iptal edilen satisin stok iadesi (COGS ters kaydi)
 *  WASTE          Fire / zayiat
 *  ADJUSTMENT     Sayim farki duzeltmesi (+/-)
 */
@Entity
@Table(
    name = "stock_transactions",
    indexes = {
        @Index(name = "idx_stock_tx_item", columnList = "item_id"),
        @Index(name = "idx_stock_tx_type", columnList = "type"),
        @Index(name = "idx_stock_tx_timestamp", columnList = "timestamp DESC"),
        @Index(name = "idx_stock_tx_reference", columnList = "referenceType, referenceId")
    }
)
public class StockTransaction {

    public static final String INBOUND = "INBOUND";
    public static final String OUTBOUND_SALE = "OUTBOUND_SALE";
    public static final String SALE_REVERSAL = "SALE_REVERSAL";
    public static final String WASTE = "WASTE";
    public static final String ADJUSTMENT = "ADJUSTMENT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "item_id", nullable = false)
    private InventoryItem item;

    @Column(nullable = false)
    private String type;

    /** Her zaman pozitif miktar; yon 'type' ile belirlenir (ADJUSTMENT haric: isaretli) */
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    private String reason;
    private String recordedBy;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    /** SALE, EXPENSE, COUNT ... */
    private String referenceType;
    private Long referenceId;
    private String documentNo;

    @Column(precision = 12, scale = 3)
    private BigDecimal balanceAfter;

    @PrePersist
    protected void onCreate() {
        if (this.timestamp == null) {
            this.timestamp = LocalDateTime.now();
        }
        if (this.totalAmount == null && this.unitCost != null && this.quantity != null) {
            this.totalAmount = this.unitCost.multiply(this.quantity);
        }
    }

    public StockTransaction() {
        this.timestamp = LocalDateTime.now();
    }

    public StockTransaction(InventoryItem item, String type, BigDecimal quantity, BigDecimal unitCost,
                            String reason, String recordedBy) {
        this.item = item;
        this.type = type;
        this.quantity = quantity;
        this.unitCost = unitCost != null ? unitCost : BigDecimal.ZERO;
        this.totalAmount = (unitCost != null && quantity != null)
                ? unitCost.multiply(quantity).setScale(2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        this.reason = reason;
        this.recordedBy = recordedBy;
        this.timestamp = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public InventoryItem getItem() { return item; }
    public void setItem(InventoryItem item) { this.item = item; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }
    public String getDocumentNo() { return documentNo; }
    public void setDocumentNo(String documentNo) { this.documentNo = documentNo; }
    public BigDecimal getBalanceAfter() { return balanceAfter; }
    public void setBalanceAfter(BigDecimal balanceAfter) { this.balanceAfter = balanceAfter; }
}
