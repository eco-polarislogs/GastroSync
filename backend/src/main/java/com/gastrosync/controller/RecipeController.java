package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.Recipe;
import com.gastrosync.service.RecipeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recipes")
@Tag(name = "Reçete Merkezi", description = "Gramaj bazlı menü reçeteleri ve porsiyon maliyeti yönetimi")
public class RecipeController {

    private final RecipeService recipeService;

    public RecipeController(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping
    @Operation(summary = "Tüm aktif reçeteleri listele")
    public ResponseEntity<ApiResponse<List<Recipe>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Reçeteler başarıyla listelendi", recipeService.getAllRecipes()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "ID ile reçete detayı getir")
    public ResponseEntity<ApiResponse<Recipe>> getById(@PathVariable Long id) {
        return recipeService.getRecipeById(id)
                .map(r -> ResponseEntity.ok(ApiResponse.ok("Reçete bulundu", r)))
                .orElse(ResponseEntity.status(404).body(ApiResponse.error("Reçete bulunamadı: " + id)));
    }

    @PostMapping
    @Operation(summary = "Yeni reçete tanımla")
    public ResponseEntity<ApiResponse<Recipe>> create(@RequestBody Recipe recipe) {
        Recipe saved = recipeService.saveRecipe(recipe);
        return ResponseEntity.ok(ApiResponse.ok("Reçete başarıyla kaydedildi", saved));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mevcut reçeteyi güncelle")
    public ResponseEntity<ApiResponse<Recipe>> update(@PathVariable Long id, @RequestBody Recipe updated) {
        return recipeService.getRecipeById(id).map(r -> {
            r.setName(updated.getName());
            r.setCategory(updated.getCategory());
            r.setSalePrice(updated.getSalePrice());
            r.setPortions(updated.getPortions());
            r.setDescription(updated.getDescription());
            if (updated.getIngredientsJson() != null) {
                r.setIngredientsJson(updated.getIngredientsJson());
            }
            Recipe saved = recipeService.saveRecipe(r);
            return ResponseEntity.ok(ApiResponse.ok("Reçete başarıyla güncellendi", saved));
        }).orElse(ResponseEntity.status(404).body(ApiResponse.error("Reçete bulunamadı: " + id)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Reçeteyi sil")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        recipeService.deleteRecipe(id);
        return ResponseEntity.ok(ApiResponse.ok("Reçete başarıyla silindi", null));
    }
}
