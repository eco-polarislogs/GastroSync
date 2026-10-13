package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "recipes")
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private BigDecimal salePrice;

    @Column(nullable = false)
    private Integer portions;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String ingredientsJson; // JSON representation of ingredients for simplicity

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
}
