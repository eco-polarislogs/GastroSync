package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_transactions")
public class StockTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "item_id", nullable = false)
    private InventoryItem item;

    @Column(nullable = false)
    private String type; // INBOUND (Mal Kabul), OUTBOUND_SALE (Satış Düşümü), WASTE (Fire/Zayiat), ADJUSTMENT (Sayım Düzeltme)

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    private String reason; // Bozulma, son kullanma, kırılma vs.

    private String recordedBy; // İşlemi yapan kullanıcı

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public StockTransaction() {
        this.timestamp = LocalDateTime.now();
    }

    public StockTransaction(InventoryItem item, String type, BigDecimal quantity, BigDecimal unitCost, 
                            String reason, String recordedBy) {
        this.item = item;
        this.type = type;
        this.quantity = quantity;
        this.unitCost = unitCost;
        this.totalAmount = unitCost != null ? unitCost.multiply(quantity) : BigDecimal.ZERO;
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
}
