package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.RecipeIngredient;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeIngredientRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Recete (BOM) yonetimi ve porsiyon maliyeti.
 *
 *  - Maliyet istemciden gelen 'cost' alanlarindan DEGIL, guncel stok ortalama maliyetinden hesaplanir.
 *  - Food cost % = porsiyon maliyeti / KDV haric satis fiyati.
 *  - Satis fiyati ve KDV orani degisikligi yalnizca Yonetici / Mudur yetkisindedir (sef gramaj tasarlar).
 */
@Service
@Transactional
public class RecipeService {

    private static final Set<Integer> VALID_VAT = Set.of(0, 1, 10, 20);

    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository ingredientRepository;
    private final InventoryItemRepository inventoryRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final NotificationService notificationService;
    private final BigDecimal defaultSalesVat;

    public RecipeService(RecipeRepository recipeRepository,
                         RecipeIngredientRepository ingredientRepository,
                         InventoryItemRepository inventoryRepository,
                         ObjectMapper objectMapper,
                         AuditService auditService,
                         CurrentUserService currentUserService,
                         NotificationService notificationService,
                         @Value("${gastrosync.tax.default-sales-vat-rate:10}") BigDecimal defaultSalesVat) {
        this.notificationService = notificationService;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.inventoryRepository = inventoryRepository;
        this.objectMapper = objectMapper;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.defaultSalesVat = defaultSalesVat;
    }

    // ── Sorgular ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Recipe> getAllRecipes() {
        List<InventoryItem> items = inventoryRepository.findAll();
        List<Recipe> recipes = recipeRepository.findAllByOrderByCategoryAscNameAsc();
        recipes.forEach(r -> enrich(r, items));
        return recipes;
    }

    @Transactional(readOnly = true)
    public Optional<Recipe> getRecipeById(Long id) {
        return recipeRepository.findById(id).map(r -> {
            enrich(r, inventoryRepository.findAll());
            return r;
        });
    }

    public BigDecimal effectiveVatRate(Recipe recipe) {
        return recipe.getVatRate() != null ? recipe.getVatRate() : defaultSalesVat;
    }

    /** Porsiyon maliyeti ve food cost yuzdesini hesaplar (transient alanlara yazar) */
    public void enrich(Recipe recipe, List<InventoryItem> items) {
        List<ResolvedIngredient> resolved = resolve(recipe, items, false);
        boolean complete = resolved.stream().allMatch(ri -> ri.item() != null);
        BigDecimal portionCost = resolved.stream()
                .filter(ri -> ri.item() != null)
                .map(ri -> ri.perPortion().multiply(safe(ri.item().getUnitCost())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        recipe.setPortionCost(portionCost);
        recipe.setCostComplete(complete);
        BigDecimal netPrice = netPrice(recipe);
        recipe.setFoodCostPercent(netPrice.signum() > 0
                ? portionCost.multiply(new BigDecimal("100")).divide(netPrice, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);
        if (recipe.getVatRate() == null) recipe.setVatRate(defaultSalesVat);
    }

    public BigDecimal netPrice(Recipe recipe) {
        BigDecimal gross = safe(recipe.getSalePrice());
        BigDecimal vat = effectiveVatRate(recipe);
        return gross.multiply(new BigDecimal("100")).divide(vat.add(new BigDecimal("100")), 2, RoundingMode.HALF_UP);
    }

    public record ResolvedIngredient(String name, BigDecimal perPortion, InventoryItem item) {}

    /**
     * Recete malzemelerini stok kartlariyla eslestirir.
     * Siralama: itemId -> birebir isim -> tek bir kalemle eslesen kismi isim.
     *
     * @param strict true ise eslesmeyen malzeme hata uretir (satis sirasinda)
     */
    public List<ResolvedIngredient> resolve(Recipe recipe, List<InventoryItem> items, boolean strict) {
        int portions = recipe.getPortions() != null && recipe.getPortions() > 0 ? recipe.getPortions() : 1;
        BigDecimal divisor = new BigDecimal(portions);
        List<ResolvedIngredient> out = new ArrayList<>();

        List<RecipeIngredient> relational = recipe.getId() != null ? ingredientRepository.findByRecipeId(recipe.getId()) : List.of();
        if (!relational.isEmpty()) {
            for (RecipeIngredient ri : relational) {
                BigDecimal per = safe(ri.getAmount()).divide(divisor, 6, RoundingMode.HALF_UP);
                out.add(new ResolvedIngredient(ri.getInventoryItem() != null ? ri.getInventoryItem().getName() : "?", per, ri.getInventoryItem()));
            }
            return out;
        }

        for (Map<String, Object> ing : parse(recipe.getIngredientsJson())) {
            String name = ing.get("name") != null ? ing.get("name").toString().trim() : null;
            BigDecimal qty = toDecimal(ing.get("quantity") != null ? ing.get("quantity") : ing.get("amount"));
            if (qty == null || qty.signum() <= 0) continue;
            InventoryItem match = match(ing, name, items);
            if (match == null && strict) {
                throw new BusinessRuleException("'" + recipe.getName() + "' recetesindeki '" + (name != null ? name : "?")
                        + "' malzemesi stok kartlariyla eslesmiyor. Receteyi guncelleyin.");
            }
            out.add(new ResolvedIngredient(name != null ? name : (match != null ? match.getName() : "?"),
                    qty.divide(divisor, 6, RoundingMode.HALF_UP), match));
        }
        return out;
    }

    private InventoryItem match(Map<String, Object> ing, String name, List<InventoryItem> items) {
        Object idObj = ing.get("itemId") != null ? ing.get("itemId") : ing.get("inventoryItemId");
        if (idObj != null && !idObj.toString().isBlank()) {
            try {
                long id = Long.parseLong(idObj.toString().replace(".0", ""));
                for (InventoryItem i : items) if (i.getId() != null && i.getId() == id) return i;
            } catch (NumberFormatException ignored) {
                // isim ile eslestir
            }
        }
        if (name == null || name.isBlank()) return null;
        String n = name.toLowerCase(Locale.ROOT);
        for (InventoryItem i : items) if (i.getName() != null && i.getName().trim().toLowerCase(Locale.ROOT).equals(n)) return i;
        List<InventoryItem> partial = items.stream()
                .filter(i -> i.getName() != null)
                .filter(i -> {
                    String in = i.getName().toLowerCase(Locale.ROOT);
                    return in.contains(n) || n.contains(in);
                })
                .toList();
        return partial.size() == 1 ? partial.get(0) : null;
    }

    private List<Map<String, Object>> parse(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("Recete malzeme listesi gecerli bir JSON dizisi olmalidir");
        }
    }

    // ── Yazma ──────────────────────────────────────────────────

    public Recipe createRecipe(Recipe input) {
        Recipe recipe = new Recipe();
        applyCommon(recipe, input);
        recipe.setSalePrice(requirePrice(input.getSalePrice()));
        recipe.setVatRate(validVat(input.getVatRate()));
        // Menu fiyati Mudur karari: sefin girdigi fiyat oneridir, onaylanana kadar recete satisa acilmaz
        boolean priceAuthority = currentUserService.can(Permissions.P.MENU_PRICE_SET);
        recipe.setPriceApproved(priceAuthority);
        Recipe saved = recipeRepository.save(recipe);
        auditService.log("RECIPE_CREATED", "RECIPE", saved.getId(), null, null,
                saved.getName() + " | " + (priceAuthority ? "satis fiyati " : "onerilen fiyat ") + saved.getSalePrice());
        if (!priceAuthority) {
            notificationService.notify(Permissions.rolesWith(Permissions.P.MENU_PRICE_SET),
                    "Fiyat Onayi Bekliyor: " + saved.getName(),
                    String.format("%s yeni '%s' recetesini olusturdu. Onerilen satis fiyati %s TL. "
                                    + "Fiyati onayladiginizda yemek kasada satisa acilir.",
                            currentUserService.displayName(), saved.getName(), ExpenseService.fmt(saved.getSalePrice())),
                    currentUserService.displayName(), "MENU_PRICE", saved.getId(), "/pricing", "WARNING");
        }
        enrich(saved, inventoryRepository.findAll());
        recipesChanged("CREATED", saved.getId());
        return saved;
    }

    /** Recete / menu fiyati degisikligi: acik recete, fiyat ve kasa (menu) ekranlari canli yenilenir */
    private void recipesChanged(String type, Long id) {
        notificationService.publish("/topic/recipes", Map.of("type", type, "id", id));
    }

    public Recipe updateRecipe(Long id, Recipe input) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recete bulunamadi: " + id));
        BigDecimal newPrice = input.getSalePrice() != null ? requirePrice(input.getSalePrice()) : recipe.getSalePrice();
        BigDecimal newVat = input.getVatRate() != null ? validVat(input.getVatRate()) : recipe.getVatRate();
        boolean priceChanged = recipe.getSalePrice() == null || newPrice.compareTo(recipe.getSalePrice()) != 0;
        boolean vatChanged = newVat != null && (recipe.getVatRate() == null || newVat.compareTo(recipe.getVatRate()) != 0);
        if ((priceChanged || vatChanged) && !currentUserService.can(Permissions.P.MENU_PRICE_SET)) {
            throw new AccessDeniedException("Menu satis fiyati / KDV orani degisikligi yalnizca Isletme Muduru yetkisindedir");
        }
        if (priceChanged) {
            auditService.log("MENU_PRICE_CHANGED", "RECIPE", id,
                    recipe.getSalePrice() != null ? recipe.getSalePrice().toPlainString() : null, newPrice.toPlainString(), recipe.getName());
        }
        applyCommon(recipe, input);
        recipe.setSalePrice(newPrice);
        recipe.setVatRate(newVat);
        Recipe saved = recipeRepository.save(recipe);
        enrich(saved, inventoryRepository.findAll());
        recipesChanged("UPDATED", id);
        return saved;
    }

    /**
     * Menu satis fiyatini gerekceli gunceller (Yonetici / Mudur). POS fiyatlari sunucudan geldigi icin
     * degisiklik tum kasalarda aninda gecerlidir; mutfak ve muhasebe bilgilendirilir.
     */
    public Recipe updatePrice(Long id, BigDecimal price, String reason) {
        if (!currentUserService.can(Permissions.P.MENU_PRICE_SET)) {
            throw new AccessDeniedException("Menu satis fiyati degisikligi yalnizca Isletme Muduru yetkisindedir");
        }
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recete bulunamadi: " + id));
        BigDecimal newPrice = requirePrice(price);
        BigDecimal old = recipe.getSalePrice();
        boolean approval = !Boolean.TRUE.equals(recipe.getPriceApproved());
        if (!approval && old != null && old.compareTo(newPrice) == 0) {
            throw new BusinessRuleException("Yeni fiyat mevcut fiyatla ayni");
        }
        String why = reason == null || reason.isBlank() ? "Maliyet analizi" : reason.trim();
        if (why.length() > 300) throw new IllegalArgumentException("Gerekce en fazla 300 karakter olabilir");
        recipe.setSalePrice(newPrice);
        recipe.setPriceApproved(true);
        Recipe saved = recipeRepository.save(recipe);
        enrich(saved, inventoryRepository.findAll());
        if (approval) {
            auditService.log("MENU_PRICE_APPROVED", "RECIPE", id, old != null ? old.toPlainString() : null, newPrice.toPlainString(),
                    saved.getName() + " | menuye alindi | " + why);
        }
        auditService.log("MENU_PRICE_CHANGED", "RECIPE", id, old != null ? old.toPlainString() : null, newPrice.toPlainString(),
                saved.getName() + " | " + why);
        notificationService.notify(List.of(AppRoles.MANAGER, AppRoles.ACCOUNTANT, AppRoles.CHEF),
                "Menü Fiyatı Güncellendi: " + saved.getName(),
                String.format("%s fiyatı %s ₺ → %s ₺ olarak güncellendi (yeni food cost %%%s). Gerekçe: %s",
                        saved.getName(), old != null ? ExpenseService.fmt(old) : "-", ExpenseService.fmt(newPrice),
                        saved.getFoodCostPercent(), why),
                currentUserService.displayName(), "MENU_PRICE", id, "/recipes", "INFO");
        recipesChanged("PRICE", id);
        return saved;
    }

    public void deleteRecipe(Long id) {
        Recipe recipe = recipeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recete bulunamadi: " + id));
        recipe.markDeleted(currentUserService.username());
        recipeRepository.save(recipe);
        recipeRepository.delete(recipe);
        auditService.log("RECIPE_DELETED", "RECIPE", id, null, null, recipe.getName());
        recipesChanged("DELETED", id);
    }

    /** Eski istemciler icin: id varsa guncelle yoksa olustur */
    public Recipe saveRecipe(Recipe recipe) {
        return recipe.getId() != null ? updateRecipe(recipe.getId(), recipe) : createRecipe(recipe);
    }

    private void applyCommon(Recipe target, Recipe input) {
        String name = input.getName() != null ? input.getName().trim() : target.getName();
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Recete adi zorunludur");
        boolean duplicate = target.getId() == null
                ? recipeRepository.existsByNameIgnoreCase(name)
                : recipeRepository.existsByNameIgnoreCaseAndIdNot(name, target.getId());
        if (duplicate) throw new BusinessRuleException("Ayni isimde recete zaten var: " + name);
        target.setName(name);
        String category = input.getCategory() != null && !input.getCategory().isBlank() ? input.getCategory().trim()
                : (target.getCategory() != null ? target.getCategory() : "Ana Yemek");
        target.setCategory(category);
        Integer portions = input.getPortions() != null ? input.getPortions() : target.getPortions();
        if (portions == null) portions = 1;
        if (portions < 1 || portions > 500) throw new IllegalArgumentException("Porsiyon sayisi 1-500 arasinda olmalidir");
        target.setPortions(portions);
        if (input.getDescription() != null) target.setDescription(input.getDescription().trim());
        if (input.getIngredientsJson() != null) {
            target.setIngredientsJson(normalizeIngredients(input.getIngredientsJson()));
        } else if (target.getIngredientsJson() == null) {
            target.setIngredientsJson("[]");
        }
    }

    /** Malzemeleri dogrular ve stok kartlariyla zenginlestirir; istemcinin gonderdigi maliyetleri atar */
    private String normalizeIngredients(String json) {
        List<InventoryItem> items = inventoryRepository.findAll();
        List<Map<String, Object>> clean = new ArrayList<>();
        for (Map<String, Object> ing : parse(json)) {
            String name = ing.get("name") != null ? ing.get("name").toString().trim() : null;
            BigDecimal qty = toDecimal(ing.get("quantity") != null ? ing.get("quantity") : ing.get("amount"));
            if (qty == null || qty.signum() <= 0) {
                throw new IllegalArgumentException("Malzeme miktari 0'dan buyuk olmalidir" + (name != null ? ": " + name : ""));
            }
            InventoryItem match = match(ing, name, items);
            Map<String, Object> row = new LinkedHashMap<>();
            if (match != null) {
                row.put("itemId", match.getId());
                row.put("name", match.getName());
                row.put("unit", match.getUnit());
            } else {
                if (name == null || name.isBlank()) throw new IllegalArgumentException("Malzeme adi zorunludur");
                row.put("name", name);
                row.put("unit", ing.get("unit") != null ? ing.get("unit").toString() : "kg");
            }
            row.put("quantity", qty.stripTrailingZeros());
            clean.add(row);
        }
        try {
            return objectMapper.writeValueAsString(clean);
        } catch (Exception e) {
            throw new IllegalStateException("Recete malzemeleri kaydedilemedi", e);
        }
    }

    private static BigDecimal requirePrice(BigDecimal price) {
        if (price == null || price.signum() <= 0) throw new IllegalArgumentException("Satis fiyati 0'dan buyuk olmalidir");
        return price.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal validVat(BigDecimal vat) {
        if (vat == null) return defaultSalesVat;
        if (!VALID_VAT.contains(vat.intValue()) || vat.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("KDV orani 0, 1, 10 veya 20 olmalidir");
        }
        return vat;
    }

    private static BigDecimal toDecimal(Object o) {
        if (o == null) return null;
        try {
            return new BigDecimal(o.toString().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    // Geriye donuk yardimcilar (testler / analiz)
    public BigDecimal calculateRecipePortionCost(Long recipeId) {
        Recipe r = recipeRepository.findById(recipeId).orElseThrow(() -> new ResourceNotFoundException("Recete bulunamadi"));
        enrich(r, inventoryRepository.findAll());
        return r.getPortionCost();
    }

    public BigDecimal calculateFoodCostPercentage(Recipe recipe, BigDecimal portionCost) {
        if (recipe.getSalePrice() != null && recipe.getSalePrice().compareTo(BigDecimal.ZERO) > 0) {
            return portionCost.divide(recipe.getSalePrice(), 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        }
        return BigDecimal.ZERO;
    }
}
