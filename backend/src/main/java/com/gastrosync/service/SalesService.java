package com.gastrosync.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.RecipeIngredient;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeIngredientRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Enterprise Service for Sales and POS Operations.
 *
 * Implements authoritative Recipe-to-Stock COGS Deduction:
 * Whenever a sale is registered (e.g., "Izgara Antrikot", "Pizza Margherita"),
 * this service automatically resolves the recipe, computes the fractional
 * ingredient amounts required, deducts them from InventoryItem in PostgreSQL,
 * and records an immutable StockTransaction of type OUTBOUND_SALE.
 */
@Service
@Transactional
public class SalesService {

    private static final Logger log = LoggerFactory.getLogger(SalesService.class);

    private final SalesRecordRepository salesRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository ingredientRepository;
    private final InventoryItemRepository inventoryRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final ObjectMapper objectMapper;

    public SalesService(SalesRecordRepository salesRepository,
                        RecipeRepository recipeRepository,
                        RecipeIngredientRepository ingredientRepository,
                        InventoryItemRepository inventoryRepository,
                        StockTransactionRepository stockTransactionRepository,
                        ObjectMapper objectMapper) {
        this.salesRepository = salesRepository;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.inventoryRepository = inventoryRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.objectMapper = objectMapper;
    }

    public List<SalesRecord> getAllSales() {
        return salesRepository.findAll();
    }

    public List<SalesRecord> getTodaySales() {
        return salesRepository.findAll();
    }

    /**
     * Authoritative Recipe-to-Stock COGS Deduction Transaction.
     */
    public SalesRecord recordSale(SalesRecord salesRecord) {
        if (salesRecord.getOrderNo() == null || salesRecord.getOrderNo().isBlank()) {
            salesRecord.setOrderNo("ORD-" + (System.currentTimeMillis() % 1000000));
        }
        if (salesRecord.getTime() == null || salesRecord.getTime().isBlank()) {
            salesRecord.setTime(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        }
        if (salesRecord.getTotalPrice() == null && salesRecord.getUnitPrice() != null && salesRecord.getQuantity() != null) {
            salesRecord.setTotalPrice(salesRecord.getUnitPrice().multiply(new BigDecimal(salesRecord.getQuantity())));
        }
        if (salesRecord.getTableNo() == null || salesRecord.getTableNo().isBlank()) {
            salesRecord.setTableNo("Masa 1");
        }
        if (salesRecord.getPaymentMethod() == null || salesRecord.getPaymentMethod().isBlank()) {
            salesRecord.setPaymentMethod("Kredi Kartı");
        }

        SalesRecord savedSale = salesRepository.save(salesRecord);

        // Recipe-to-Stock COGS Deduction
        deductRecipeIngredientsFromStock(savedSale);

        return savedSale;
    }

    private void deductRecipeIngredientsFromStock(SalesRecord sale) {
        String productName = sale.getProductName();
        if (productName == null || productName.isBlank()) return;

        int quantitySold = sale.getQuantity() != null && sale.getQuantity() > 0 ? sale.getQuantity() : 1;
        BigDecimal qtyMultiplier = new BigDecimal(quantitySold);

        // 1. Try to find matching recipe
        Optional<Recipe> recipeOpt = recipeRepository.findFirstByNameIgnoreCase(productName.trim());
        if (recipeOpt.isEmpty()) {
            recipeOpt = recipeRepository.findFirstByNameContainingIgnoreCase(productName.trim());
        }

        if (recipeOpt.isEmpty()) {
            log.info("No matching recipe found for sold item '{}'. Skipping direct ingredient deduction.", productName);
            return;
        }

        Recipe recipe = recipeOpt.get();
        String operator = getCurrentUsername();

        // 2. Try relational RecipeIngredient first
        List<RecipeIngredient> relationalIngredients = ingredientRepository.findByRecipeId(recipe.getId());
        if (!relationalIngredients.isEmpty()) {
            for (RecipeIngredient ing : relationalIngredients) {
                InventoryItem item = ing.getInventoryItem();
                if (item != null && ing.getAmount() != null) {
                    BigDecimal amountUsed = ing.getAmount().multiply(qtyMultiplier);
                    deductAndLogTransaction(item, amountUsed, recipe.getName(), sale.getOrderNo(), operator, quantitySold);
                }
            }
            return;
        }

        // 3. Fallback to Recipe ingredientsJson
        String json = recipe.getIngredientsJson();
        if (json != null && !json.isBlank()) {
            try {
                List<Map<String, Object>> ingredients = objectMapper.readValue(json, new TypeReference<>() {});
                for (Map<String, Object> ing : ingredients) {
                    String ingName = (String) ing.get("name");
                    Object qtyObj = ing.get("quantity");
                    if (ingName != null && qtyObj != null) {
                        BigDecimal perPortion = new BigDecimal(qtyObj.toString());
                        BigDecimal totalUsed = perPortion.multiply(qtyMultiplier);

                        Optional<InventoryItem> itemOpt = inventoryRepository.findFirstByNameIgnoreCase(ingName.trim());
                        if (itemOpt.isEmpty()) {
                            itemOpt = inventoryRepository.findFirstByNameContainingIgnoreCase(ingName.trim());
                        }

                        if (itemOpt.isPresent()) {
                            deductAndLogTransaction(itemOpt.get(), totalUsed, recipe.getName(), sale.getOrderNo(), operator, quantitySold);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse recipe ingredients JSON for recipe {}: {}", recipe.getName(), e.getMessage());
            }
        }
    }

    private void deductAndLogTransaction(InventoryItem item, BigDecimal amountUsed, String recipeName, String orderNo, String operator, int quantitySold) {
        BigDecimal current = item.getCurrentStock() != null ? item.getCurrentStock() : BigDecimal.ZERO;
        BigDecimal updatedStock = current.subtract(amountUsed);
        item.setCurrentStock(updatedStock);
        inventoryRepository.save(item);

        BigDecimal unitCost = item.getUnitCost() != null ? item.getUnitCost() : BigDecimal.ZERO;
        BigDecimal totalCost = unitCost.multiply(amountUsed);

        StockTransaction tx = new StockTransaction(
            item,
            "OUTBOUND_SALE",
            amountUsed,
            unitCost,
            String.format("Reçete Satış Düşümü (%s x%d) - Sipariş: %s", recipeName, quantitySold, orderNo),
            operator
        );
        tx.setTotalAmount(totalCost);
        stockTransactionRepository.save(tx);

        log.info("📉 Deducted {} {} of '{}' from stock for sale of {} (New stock: {})",
            amountUsed, item.getUnit(), item.getName(), recipeName, updatedStock);
    }

    public Map<String, Object> getSalesSummary() {
        List<SalesRecord> sales = salesRepository.findAll();
        BigDecimal totalRevenue = sales.stream()
                .map(s -> s.getTotalPrice() != null ? s.getTotalPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Authoritative COGS: strictly calculated from actual ingredient deductions logged in PostgreSQL stock transactions
        BigDecimal totalCost = stockTransactionRepository.calculateTotalCogs();
        if (totalCost == null) {
            totalCost = BigDecimal.ZERO;
        }
        totalCost = totalCost.setScale(2, RoundingMode.HALF_UP);

        BigDecimal netProfit = totalRevenue.subtract(totalCost);
        BigDecimal foodCostPercent = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalCost.divide(totalRevenue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100")).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalCost", totalCost);
        summary.put("netProfit", netProfit);
        summary.put("foodCostPercent", foodCostPercent);
        summary.put("totalSalesCount", sales.size());

        return summary;
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getName().equalsIgnoreCase("anonymousUser")) {
            return auth.getName();
        }
        return "POS_SYSTEM";
    }
}
