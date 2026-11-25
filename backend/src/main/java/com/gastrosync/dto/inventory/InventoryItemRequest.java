package com.gastrosync.dto.inventory;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Stok karti olusturma / guncelleme istegi.
 * Not: Guncellemede currentStock YOK SAYILIR; stok miktari yalnizca hareketlerle
 * (mal kabul, satis, fire, sayim duzeltmesi) degisir.
 */
public class InventoryItemRequest {

    @NotBlank(message = "Urun adi zorunludur")
    @Size(max = 150)
    private String name;

    @NotBlank(message = "Kategori zorunludur")
    @Size(max = 100)
    private String category;

    @DecimalMin(value = "0.0", message = "Stok negatif olamaz")
    private BigDecimal currentStock;

    @DecimalMin(value = "0.0", message = "Minimum stok negatif olamaz")
    private BigDecimal minStock;

    @NotBlank(message = "Birim zorunludur")
    @Size(max = 20)
    private String unit;

    @DecimalMin(value = "0.0", message = "Birim maliyet negatif olamaz")
    private BigDecimal unitCost;

    @Size(max = 150)
    private String supplier;

    @Size(max = 64)
    private String barcode;

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
}
