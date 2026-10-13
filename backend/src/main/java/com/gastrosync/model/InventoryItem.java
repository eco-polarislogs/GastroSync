package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private BigDecimal currentStock;

    @Column(nullable = false)
    private BigDecimal minStock;

    @Column(nullable = false)
    private String unit;

    @Column(nullable = false)
    private BigDecimal unitCost;

    @Column(nullable = false)
    private String supplier;

    private String barcode;

    private String lastUpdated;

    public InventoryItem() {}

    public InventoryItem(String name, String category, BigDecimal currentStock, BigDecimal minStock, 
                         String unit, BigDecimal unitCost, String supplier, String barcode, String lastUpdated) {
        this.name = name;
        this.category = category;
        this.currentStock = currentStock;
        this.minStock = minStock;
        this.unit = unit;
        this.unitCost = unitCost;
        this.supplier = supplier;
        this.barcode = barcode;
        this.lastUpdated = lastUpdated;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public BigDecimal getCurrentStock() { return currentStock; }
    public void setCurrentStock(BigDecimal currentStock) { this.currentStock = currentStock; }

    public BigDecimal getMinStock() { return minStock; }
    public void setMinStock(BigDecimal minStock) { this.minStock = minStock; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }

    public String getSupplier() { return supplier; }
    public void setSupplier(String supplier) { this.supplier = supplier; }

    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }

    public String getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(String lastUpdated) { this.lastUpdated = lastUpdated; }
}
