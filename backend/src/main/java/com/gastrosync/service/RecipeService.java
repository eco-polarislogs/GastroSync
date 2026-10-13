package com.gastrosync.service;

import com.gastrosync.model.Recipe;
import com.gastrosync.model.RecipeIngredient;
import com.gastrosync.repository.RecipeIngredientRepository;
import com.gastrosync.repository.RecipeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class RecipeService {

    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository ingredientRepository;

    public RecipeService(RecipeRepository recipeRepository, RecipeIngredientRepository ingredientRepository) {
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
    }

    public List<Recipe> getAllRecipes() {
        return recipeRepository.findAll();
    }

    public Optional<Recipe> getRecipeById(Long id) {
        return recipeRepository.findById(id);
    }

    public Recipe saveRecipe(Recipe recipe) {
        return recipeRepository.save(recipe);
    }

    public void deleteRecipe(Long id) {
        recipeRepository.deleteById(id);
    }

    /**
     * Reçetenin anlık porsiyon maliyetini ve gıda maliyeti yüzdesini hesaplar
     */
    public BigDecimal calculateRecipePortionCost(Long recipeId) {
        List<RecipeIngredient> ingredients = ingredientRepository.findByRecipeId(recipeId);
        return ingredients.stream()
                .map(RecipeIngredient::calculateCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal calculateFoodCostPercentage(Recipe recipe, BigDecimal portionCost) {
        if (recipe.getSalePrice() != null && recipe.getSalePrice().compareTo(BigDecimal.ZERO) > 0) {
            return portionCost.divide(recipe.getSalePrice(), 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        }
        return BigDecimal.ZERO;
    }
}
