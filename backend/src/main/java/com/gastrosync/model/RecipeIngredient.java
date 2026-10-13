package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "recipe_ingredients")
public class RecipeIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal amount; // Reçete porsiyonu başına harcanan miktar

    @Column(nullable = false)
    private String unit;

    public RecipeIngredient() {}

    public RecipeIngredient(Recipe recipe, InventoryItem inventoryItem, BigDecimal amount, String unit) {
        this.recipe = recipe;
        this.inventoryItem = inventoryItem;
        this.amount = amount;
        this.unit = unit;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Recipe getRecipe() { return recipe; }
    public void setRecipe(Recipe recipe) { this.recipe = recipe; }

    public InventoryItem getInventoryItem() { return inventoryItem; }
    public void setInventoryItem(InventoryItem inventoryItem) { this.inventoryItem = inventoryItem; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public BigDecimal calculateCost() {
        if (inventoryItem != null && inventoryItem.getUnitCost() != null && amount != null) {
            return inventoryItem.getUnitCost().multiply(amount);
        }
        return BigDecimal.ZERO;
    }
}
