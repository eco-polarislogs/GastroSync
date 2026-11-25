package com.gastrosync.model;

import java.math.BigDecimal;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * Menu recetesi (BOM). ingredientsJson: [{itemId, name, quantity, unit}, ...]
 * 'quantity' recetenin tamami (portions adet porsiyon) icindir.
 *
 * portionCost / foodCostPercent veritabaninda tutulmaz; her okumada GUNCEL stok
 * birim maliyetlerinden sunucuda hesaplanir (RecipeService).
 */
@Entity
@Table(name = "recipes")
@SQLDelete(sql = "UPDATE recipes SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("is_deleted = false")
public class Recipe extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    /** KDV dahil menu satis fiyati */
    @Column(nullable = false)
    private BigDecimal salePrice;

    @Column(nullable = false)
    private Integer portions;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String ingredientsJson;

    @Column(precision = 5, scale = 2)
    private BigDecimal vatRate;

    /**
     * Sefin olusturdugu yeni recete, Isletme Muduru satis fiyatini onaylayana kadar menude (POS) gorunmez.
     * null: onayli (eski kayitlar).
     */
    @Column(name = "price_approved")
    private Boolean priceApproved;

    @Transient
    private BigDecimal portionCost;

    @Transient
    private BigDecimal foodCostPercent;

    @Transient
    private boolean costComplete = true;

    public Recipe() {}

    public Recipe(String name, String category, BigDecimal salePrice, Integer portions, String description, String ingredientsJson) {
        this.name = name;
        this.category = category;
        this.salePrice = salePrice;
        this.portions = portions;
        this.description = description;
        this.ingredientsJson = ingredientsJson;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public BigDecimal getSalePrice() { return salePrice; }
    public void setSalePrice(BigDecimal salePrice) { this.salePrice = salePrice; }
    public Integer getPortions() { return portions; }
    public void setPortions(Integer portions) { this.portions = portions; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getIngredientsJson() { return ingredientsJson; }
    public void setIngredientsJson(String ingredientsJson) { this.ingredientsJson = ingredientsJson; }
    public BigDecimal getVatRate() { return vatRate; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public BigDecimal getPortionCost() { return portionCost; }
    public void setPortionCost(BigDecimal portionCost) { this.portionCost = portionCost; }
    public BigDecimal getFoodCostPercent() { return foodCostPercent; }
    public void setFoodCostPercent(BigDecimal foodCostPercent) { this.foodCostPercent = foodCostPercent; }
    public Boolean getPriceApproved() { return !Boolean.FALSE.equals(priceApproved); }
    public void setPriceApproved(Boolean priceApproved) { this.priceApproved = priceApproved; }
    public boolean isCostComplete() { return costComplete; }
    public void setCostComplete(boolean costComplete) { this.costComplete = costComplete; }
}
