package com.gastrosync.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.Recipe;
import com.gastrosync.service.RecipeService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/recipes")
@Tag(name = "Recete Merkezi", description = "Gramaj bazli receteler ve guncel porsiyon maliyeti")
public class RecipeController {

    private final RecipeService recipeService;

    public RecipeController(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping
    @PreAuthorize("@perm.can('RECIPE_VIEW')")
    @Operation(summary = "Receteler (porsiyon maliyeti guncel stok maliyetinden hesaplanir)")
    public ResponseEntity<ApiResponse<List<Recipe>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Receteler", recipeService.getAllRecipes()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('RECIPE_VIEW')")
    public ResponseEntity<ApiResponse<Recipe>> getById(@PathVariable("id") Long id) {
        Recipe recipe = recipeService.getRecipeById(id).orElseThrow(() -> new ResourceNotFoundException("Recete bulunamadi: " + id));
        return ResponseEntity.ok(ApiResponse.ok("Recete", recipe));
    }

    @PostMapping
    @PreAuthorize("@perm.can('RECIPE_EDIT')")
    @Operation(summary = "Yeni recete")
    public ResponseEntity<ApiResponse<Recipe>> create(@RequestBody Recipe recipe) {
        recipe.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Recete kaydedildi", recipeService.createRecipe(recipe)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('RECIPE_EDIT')")
    @Operation(summary = "Receteyi guncelle (fiyat/KDV degisikligi yalnizca Yonetici/Mudur)")
    public ResponseEntity<ApiResponse<Recipe>> update(@PathVariable("id") Long id, @RequestBody Recipe recipe) {
        return ResponseEntity.ok(ApiResponse.ok("Recete guncellendi", recipeService.updateRecipe(id, recipe)));
    }

    @PutMapping("/{id}/price")
    @PreAuthorize("@perm.can('MENU_PRICE_SET')")
    @Operation(summary = "Menu satis fiyatini gerekceli guncelle (Yonetici / Mudur)")
    public ResponseEntity<ApiResponse<Recipe>> updatePrice(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        Object raw = body != null ? body.get("salePrice") : null;
        BigDecimal price = raw == null ? null : InventoryController.decimal(raw, "salePrice");
        String reason = body != null && body.get("reason") != null ? body.get("reason").toString() : null;
        return ResponseEntity.ok(ApiResponse.ok("Menu fiyati guncellendi", recipeService.updatePrice(id, price, reason)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.can('MENU_PRICE_SET')")
    @Operation(summary = "Receteyi menuden kaldir (arsivle)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delete(@PathVariable("id") Long id) {
        recipeService.deleteRecipe(id);
        return ResponseEntity.ok(ApiResponse.ok("Recete arsivlendi", Map.of("id", id)));
    }
}
