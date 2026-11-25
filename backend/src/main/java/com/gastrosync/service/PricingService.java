package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Menu fiyatlama ve maliyet dalgalanmasi analizi.
 *
 *  - Maliyet dalgalanmasi: her stok kaleminin alis fiyati gecmisi (mal kabul hareketleri) izlenir;
 *    son alis fiyati ile donem basi fiyati karsilastirilir.
 *  - Menu muhendisligi (Kasavana-Smith): her yemek populerlik (satis payi) ve katki payi
 *    (KDV haric fiyat - porsiyon maliyeti) ile Yildiz / Is Ati / Bulmaca / Zayif olarak siniflanir.
 *  - Gelir-gider orani: donemin faaliyet giderleri satilan porsiyonlara dagitilarak porsiyon basina
 *    genel gider payi ve basabas satis fiyati hesaplanir (yalnizca mali yetkililere gosterilir).
 *  - Onerilen fiyat: hedef food cost oranina gore; ortalama maliyet ile son alis fiyatindan yuksek olani
 *    esas alinir (fiyat artisi stoga yansimadan marj korunur).
 *  - Mal kabulde alis fiyati esik degerden fazla degisirse etkilenen receteler ve porsiyon basi etki
 *    yonetime, muhasebeye ve mutfaga anlik bildirilir.
 */
@Service
@Transactional(readOnly = true)
public class PricingService {

    private static final Logger log = LoggerFactory.getLogger(PricingService.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public static final String STAR = "STAR";
    public static final String PLOWHORSE = "PLOWHORSE";
    public static final String PUZZLE = "PUZZLE";
    public static final String DOG = "DOG";
    public static final String NO_DATA = "NO_DATA";

    private final RecipeRepository recipeRepository;
    private final RecipeService recipeService;
    private final InventoryItemRepository itemRepository;
    private final StockTransactionRepository transactionRepository;
    private final SalesRecordRepository salesRepository;
    private final ExpenseRepository expenseRepository;
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;
    private final BigDecimal targetFoodCost;
    private final BigDecimal alertThreshold;

    public PricingService(RecipeRepository recipeRepository,
                          RecipeService recipeService,
                          InventoryItemRepository itemRepository,
                          StockTransactionRepository transactionRepository,
                          SalesRecordRepository salesRepository,
                          ExpenseRepository expenseRepository,
                          NotificationService notificationService,
                          CurrentUserService currentUserService,
                          @Value("${gastrosync.analytics.target-food-cost-percent:30.0}") BigDecimal targetFoodCost,
                          @Value("${gastrosync.pricing.alert-threshold-percent:8}") BigDecimal alertThreshold) {
        this.recipeRepository = recipeRepository;
        this.recipeService = recipeService;
        this.itemRepository = itemRepository;
        this.transactionRepository = transactionRepository;
        this.salesRepository = salesRepository;
        this.expenseRepository = expenseRepository;
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
        this.targetFoodCost = targetFoodCost;
        this.alertThreshold = alertThreshold;
    }

    /** Bir stok kaleminin alis fiyati gecmisinden turetilen degerler */
    record PriceHistory(BigDecimal start, BigDecimal last, BigDecimal previous, BigDecimal min, BigDecimal max,
                        int purchases, LocalDateTime lastAt) {}

    // ── Analiz ─────────────────────────────────────────────────

    public Map<String, Object> menuPricing(Integer rawDays) {
        int days = rawDays == null ? 30 : Math.max(7, Math.min(rawDays, 180));
        LocalDate today = LocalDate.now();
        LocalDate fromDate = today.minusDays(days - 1L);
        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to = today.plusDays(1).atStartOfDay();
        boolean finance = currentUserService.can(Permissions.P.PRICING_FINANCIALS);

        List<InventoryItem> items = itemRepository.findAll();
        Map<Long, PriceHistory> history = priceHistory(items, from);

        // Donem tuketimi (satis + fire; iptal edilen satislar geri eklenir)
        Map<Long, BigDecimal> usage = new HashMap<>();
        for (StockTransaction t : transactionRepository.findByTimestampBetween(from, to)) {
            if (t.getItem() == null || t.getQuantity() == null) continue;
            Long id = t.getItem().getId();
            switch (t.getType()) {
                case StockTransaction.OUTBOUND_SALE, StockTransaction.WASTE -> usage.merge(id, t.getQuantity().abs(), BigDecimal::add);
                case StockTransaction.SALE_REVERSAL -> usage.merge(id, t.getQuantity().abs().negate(), BigDecimal::add);
                default -> { }
            }
        }

        // Donem satislari (iptaller haric)
        List<SalesRecord> sales = salesRepository.findBySoldAtBetweenAndStatusOrderBySoldAtDesc(from, to, SalesRecord.STATUS_COMPLETED);
        List<Recipe> recipes = recipeRepository.findAll();
        Map<String, Long> recipeIdByName = new HashMap<>();
        for (Recipe r : recipes) if (r.getName() != null) recipeIdByName.put(r.getName().trim().toLowerCase(Locale.ROOT), r.getId());
        Map<Long, long[]> qtyByRecipe = new HashMap<>();
        Map<Long, BigDecimal[]> moneyByRecipe = new HashMap<>();
        long totalQty = 0;
        BigDecimal totalNet = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        for (SalesRecord s : sales) {
            Long rid = s.getRecipeId() != null ? s.getRecipeId()
                    : (s.getProductName() != null ? recipeIdByName.get(s.getProductName().trim().toLowerCase(Locale.ROOT)) : null);
            int q = s.getQuantity() != null ? s.getQuantity() : 0;
            BigDecimal net = safe(s.getTotalPrice()).subtract(safe(s.getVatAmount()));
            BigDecimal cost = safe(s.getTotalCost());
            totalQty += q;
            totalNet = totalNet.add(net);
            totalCost = totalCost.add(cost);
            if (rid == null) continue;
            qtyByRecipe.computeIfAbsent(rid, k -> new long[1])[0] += q;
            BigDecimal[] m = moneyByRecipe.computeIfAbsent(rid, k -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
            m[0] = m[0].add(net);
            m[1] = m[1].add(cost);
        }

        // Gelir-gider orani: stok alimi disindaki faaliyet giderleri (KDV haric) / satilan porsiyon
        BigDecimal operatingExpenses = BigDecimal.ZERO;
        for (Expense e : expenseRepository.findAll()) {
            if (Expense.STATUS_REJECTED.equals(e.getStatus()) || e.getExpenseDate() == null) continue;
            if (e.getExpenseDate().isBefore(fromDate) || e.getExpenseDate().isAfter(today)) continue;
            if (ExpenseCatalog.isInventoryPurchase(e.getSubType())) continue;
            BigDecimal vat = safe(e.getVatRate());
            operatingExpenses = operatingExpenses.add(safe(e.getAmount()).multiply(HUNDRED)
                    .divide(HUNDRED.add(vat), 2, RoundingMode.HALF_UP));
        }
        BigDecimal overheadPerPortion = totalQty > 0
                ? operatingExpenses.divide(BigDecimal.valueOf(totalQty), 2, RoundingMode.HALF_UP) : null;

        // Recete satirlari
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<Long, Integer> recipeUseCount = new HashMap<>();
        BigDecimal cmWeighted = BigDecimal.ZERO;
        long cmQty = 0;
        for (Recipe r : recipes) {
            recipeService.enrich(r, items);
            List<RecipeService.ResolvedIngredient> resolved = recipeService.resolve(r, items, false);
            BigDecimal replacement = BigDecimal.ZERO;
            BigDecimal startCost = BigDecimal.ZERO;
            for (RecipeService.ResolvedIngredient ri : resolved) {
                if (ri.item() == null) continue;
                recipeUseCount.merge(ri.item().getId(), 1, Integer::sum);
                PriceHistory h = history.get(ri.item().getId());
                BigDecimal avg = safe(ri.item().getUnitCost());
                replacement = replacement.add(ri.perPortion().multiply(h != null ? h.last() : avg));
                startCost = startCost.add(ri.perPortion().multiply(h != null ? h.start() : avg));
            }
            replacement = replacement.setScale(2, RoundingMode.HALF_UP);
            startCost = startCost.setScale(2, RoundingMode.HALF_UP);
            BigDecimal portionCost = safe(r.getPortionCost());
            BigDecimal pricingCost = portionCost.max(replacement);
            BigDecimal netPrice = recipeService.netPrice(r);
            BigDecimal vat = recipeService.effectiveVatRate(r);
            BigDecimal cm = netPrice.subtract(portionCost).setScale(2, RoundingMode.HALF_UP);
            long qty = qtyByRecipe.getOrDefault(r.getId(), new long[1])[0];
            BigDecimal[] money = moneyByRecipe.getOrDefault(r.getId(), new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
            if (qty > 0) {
                cmWeighted = cmWeighted.add(cm.multiply(BigDecimal.valueOf(qty)));
                cmQty += qty;
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", r.getId());
            row.put("name", r.getName());
            row.put("category", r.getCategory());
            row.put("priceApproved", Boolean.TRUE.equals(r.getPriceApproved()));
            row.put("salePrice", safe(r.getSalePrice()));
            row.put("netPrice", netPrice);
            row.put("vatRate", vat);
            row.put("portionCost", portionCost);
            row.put("replacementCost", replacement);
            row.put("startCost", startCost);
            row.put("costChangePercent", percentChange(startCost, replacement));
            row.put("foodCostPercent", safe(r.getFoodCostPercent()));
            row.put("replacementFoodCostPercent", ratio(pricingCost, netPrice));
            row.put("contributionMargin", cm);
            row.put("quantitySold", qty);
            row.put("netRevenue", money[0].setScale(2, RoundingMode.HALF_UP));
            row.put("totalMargin", money[0].subtract(money[1]).setScale(2, RoundingMode.HALF_UP));
            row.put("costComplete", r.isCostComplete());
            row.put("suggestedPrice", suggestedPrice(pricingCost, vat));
            if (finance && overheadPerPortion != null) {
                row.put("breakEvenPrice", grossOf(pricingCost.add(overheadPerPortion), vat));
            }
            rows.add(row);
        }

        // Menu muhendisligi siniflamasi
        int n = rows.size();
        BigDecimal avgCm = cmQty > 0 ? cmWeighted.divide(BigDecimal.valueOf(cmQty), 2, RoundingMode.HALF_UP) : null;
        BigDecimal popThreshold = n > 0 ? HUNDRED.divide(BigDecimal.valueOf(n), 4, RoundingMode.HALF_UP).multiply(new BigDecimal("0.7")) : BigDecimal.ZERO;
        Map<String, Integer> classCounts = new LinkedHashMap<>();
        for (String c : List.of(STAR, PLOWHORSE, PUZZLE, DOG, NO_DATA)) classCounts.put(c, 0);
        int raiseCount = 0;
        int lossCount = 0;
        for (Map<String, Object> row : rows) {
            long qty = (Long) row.get("quantitySold");
            BigDecimal mix = totalQty > 0 ? BigDecimal.valueOf(qty).multiply(HUNDRED).divide(BigDecimal.valueOf(totalQty), 1, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            row.put("popularityPercent", mix);
            String cls;
            if (totalQty == 0 || avgCm == null) {
                cls = NO_DATA;
            } else {
                boolean highPop = mix.compareTo(popThreshold) >= 0;
                boolean highCm = ((BigDecimal) row.get("contributionMargin")).compareTo(avgCm) >= 0;
                cls = highPop ? (highCm ? STAR : PLOWHORSE) : (highCm ? PUZZLE : DOG);
            }
            row.put("menuClass", cls);
            classCounts.merge(cls, 1, Integer::sum);

            BigDecimal salePrice = (BigDecimal) row.get("salePrice");
            BigDecimal breakEven = finance ? (BigDecimal) row.get("breakEvenPrice") : null;
            BigDecimal fc = (BigDecimal) row.get("replacementFoodCostPercent");
            BigDecimal change = (BigDecimal) row.get("costChangePercent");
            String action;
            if (breakEven != null && salePrice.compareTo(breakEven) < 0) {
                action = "LOSS";
                lossCount++;
            } else if (fc.compareTo(targetFoodCost.add(new BigDecimal("2"))) > 0) {
                action = "RAISE";
                raiseCount++;
            } else if (change.compareTo(alertThreshold) >= 0) {
                action = "WATCH";
            } else {
                action = "OK";
            }
            row.put("priceAction", action);
            row.put("advice", advice(cls, action, row));
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> actionRank((String) r.get("priceAction")))
                .thenComparing(r -> (BigDecimal) r.get("replacementFoodCostPercent"), Comparator.reverseOrder()));

        // Malzeme fiyat dalgalanmasi
        List<Map<String, Object>> ingredientRows = new ArrayList<>();
        int increasing = 0;
        for (InventoryItem i : items) {
            PriceHistory h = history.get(i.getId());
            BigDecimal avg = safe(i.getUnitCost());
            BigDecimal used = usage.getOrDefault(i.getId(), BigDecimal.ZERO).max(BigDecimal.ZERO);
            BigDecimal daily = used.divide(BigDecimal.valueOf(days), 3, RoundingMode.HALF_UP);
            BigDecimal stock = safe(i.getCurrentStock());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", i.getId());
            row.put("name", i.getName());
            row.put("category", i.getCategory());
            row.put("unit", i.getUnit());
            row.put("supplier", i.getSupplier());
            row.put("averageCost", avg);
            row.put("lastPurchaseCost", h != null ? h.last() : null);
            row.put("previousPurchaseCost", h != null ? h.previous() : null);
            row.put("changePercent", h != null && h.previous() != null ? percentChange(h.previous(), h.last()) : BigDecimal.ZERO);
            row.put("periodStartCost", h != null ? h.start() : null);
            BigDecimal periodChange = h != null ? percentChange(h.start(), h.last()) : BigDecimal.ZERO;
            row.put("periodChangePercent", periodChange);
            row.put("minCost", h != null ? h.min() : null);
            row.put("maxCost", h != null ? h.max() : null);
            row.put("purchaseCount", h != null ? h.purchases() : 0);
            row.put("lastPurchaseAt", h != null ? h.lastAt() : null);
            row.put("currentStock", stock);
            row.put("minStock", safe(i.getMinStock()));
            row.put("avgDailyUsage", daily);
            row.put("daysOfCover", daily.signum() > 0 ? stock.divide(daily, 1, RoundingMode.HALF_UP) : null);
            row.put("critical", InventoryService.isCritical(i));
            row.put("usedInRecipes", recipeUseCount.getOrDefault(i.getId(), 0));
            if (periodChange.compareTo(alertThreshold) >= 0) increasing++;
            ingredientRows.add(row);
        }
        ingredientRows.sort(Comparator.comparing((Map<String, Object> r) -> ((BigDecimal) r.get("periodChangePercent")).abs(), Comparator.reverseOrder())
                .thenComparing(r -> String.valueOf(r.get("name"))));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("targetFoodCostPercent", targetFoodCost);
        summary.put("alertThresholdPercent", alertThreshold);
        summary.put("menuCount", n);
        summary.put("portionsSold", totalQty);
        summary.put("salesFoodCostPercent", ratio(totalCost, totalNet));
        summary.put("averageContributionMargin", avgCm);
        summary.put("raiseCount", raiseCount);
        summary.put("lossCount", lossCount);
        summary.put("increasingIngredients", increasing);
        summary.put("classCounts", classCounts);
        if (finance) {
            summary.put("netRevenue", totalNet.setScale(2, RoundingMode.HALF_UP));
            summary.put("cogs", totalCost.setScale(2, RoundingMode.HALF_UP));
            summary.put("operatingExpenses", operatingExpenses);
            summary.put("overheadPerPortion", overheadPerPortion);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", days);
        out.put("from", fromDate);
        out.put("to", today);
        out.put("financeView", finance);
        out.put("summary", summary);
        out.put("alerts", alerts(rows, ingredientRows));
        out.put("recipes", rows);
        out.put("ingredients", ingredientRows);
        return out;
    }

    private Map<Long, PriceHistory> priceHistory(List<InventoryItem> items, LocalDateTime from) {
        Map<Long, List<StockTransaction>> byItem = new HashMap<>();
        for (StockTransaction t : transactionRepository.findInboundHistory()) {
            if (t.getItem() == null || t.getUnitCost() == null || t.getUnitCost().signum() <= 0) continue;
            byItem.computeIfAbsent(t.getItem().getId(), k -> new ArrayList<>()).add(t);
        }
        Map<Long, PriceHistory> out = new HashMap<>();
        for (InventoryItem i : items) {
            List<StockTransaction> list = byItem.get(i.getId());
            if (list == null || list.isEmpty()) continue;
            StockTransaction last = list.get(list.size() - 1);
            BigDecimal previous = list.size() > 1 ? list.get(list.size() - 2).getUnitCost() : null;
            BigDecimal start = null;
            BigDecimal min = null;
            BigDecimal max = null;
            int inWindow = 0;
            for (StockTransaction t : list) {
                boolean before = t.getTimestamp() != null && t.getTimestamp().isBefore(from);
                if (before) {
                    start = t.getUnitCost();
                } else {
                    if (start == null) start = t.getUnitCost();
                    min = min == null ? t.getUnitCost() : min.min(t.getUnitCost());
                    max = max == null ? t.getUnitCost() : max.max(t.getUnitCost());
                    inWindow++;
                }
            }
            if (min == null) {
                min = last.getUnitCost();
                max = last.getUnitCost();
            }
            out.put(i.getId(), new PriceHistory(start, last.getUnitCost(), previous, min, max, inWindow, last.getTimestamp()));
        }
        return out;
    }

    private List<Map<String, Object>> alerts(List<Map<String, Object>> recipes, List<Map<String, Object>> ingredients) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> i : ingredients) {
            BigDecimal change = (BigDecimal) i.get("periodChangePercent");
            if (change.abs().compareTo(alertThreshold) < 0 || i.get("periodStartCost") == null) continue;
            boolean up = change.signum() > 0;
            out.add(alert(up ? "WARNING" : "INFO",
                    (up ? "Alış fiyatı arttı: " : "Alış fiyatı düştü: ") + i.get("name"),
                    String.format(Locale.forLanguageTag("tr-TR"), "%s/%s: %s ₺ → %s ₺ (%s%%). %d reçetede kullanılıyor.",
                            i.get("name"), i.get("unit"), fmt((BigDecimal) i.get("periodStartCost")),
                            fmt((BigDecimal) i.get("lastPurchaseCost")), signed(change), (Integer) i.get("usedInRecipes")),
                    "/pricing"));
        }
        for (Map<String, Object> r : recipes) {
            String action = (String) r.get("priceAction");
            if (!"LOSS".equals(action) && !"RAISE".equals(action)) continue;
            out.add(alert("LOSS".equals(action) ? "CRITICAL" : "WARNING",
                    ("LOSS".equals(action) ? "Tabak başı zarar: " : "Fiyat güncellemesi önerilir: ") + r.get("name"),
                    String.format(Locale.forLanguageTag("tr-TR"), "Food cost %%%s (hedef %%%s). Mevcut fiyat %s ₺, önerilen %s ₺.",
                            r.get("replacementFoodCostPercent"), targetFoodCost.stripTrailingZeros().toPlainString(),
                            fmt((BigDecimal) r.get("salePrice")), fmt((BigDecimal) r.get("suggestedPrice"))),
                    "/pricing"));
        }
        for (Map<String, Object> i : ingredients) {
            BigDecimal cover = (BigDecimal) i.get("daysOfCover");
            if (cover == null || cover.compareTo(new BigDecimal("3")) >= 0) continue;
            out.add(alert("WARNING", "Stok tükenmek üzere: " + i.get("name"),
                    String.format(Locale.forLanguageTag("tr-TR"), "Mevcut stok yaklaşık %s günlük (günlük tüketim %s %s). Tedarik talebi açın.",
                            cover.toPlainString(), ((BigDecimal) i.get("avgDailyUsage")).stripTrailingZeros().toPlainString(), i.get("unit")),
                    "/inventory"));
        }
        out.sort(Comparator.comparing(a -> severityRank((String) a.get("severity"))));
        return out.size() > 15 ? new ArrayList<>(out.subList(0, 15)) : out;
    }

    // ── Mal kabulde fiyat degisimi uyarisi ─────────────────────

    /**
     * Alis fiyati referansa (onceki alis fiyati, yoksa ortalama maliyet) gore esik degerden fazla
     * degistiyse etkilenen receteleri ve porsiyon basi etkiyi bildirir. Hesaplama hatasi mal kabulu engellemez.
     */
    @Transactional
    public void onPurchasePrice(InventoryItem item, BigDecimal reference, BigDecimal newPrice) {
        try {
            if (item == null || reference == null || newPrice == null || reference.signum() <= 0) return;
            BigDecimal change = percentChange(reference, newPrice);
            if (change.abs().compareTo(alertThreshold) < 0) return;

            List<InventoryItem> items = itemRepository.findAll();
            List<String> impacts = new ArrayList<>();
            boolean overTarget = false;
            for (Recipe r : recipeRepository.findAll()) {
                List<RecipeService.ResolvedIngredient> resolved = recipeService.resolve(r, items, false);
                BigDecimal per = BigDecimal.ZERO;
                BigDecimal others = BigDecimal.ZERO;
                for (RecipeService.ResolvedIngredient ri : resolved) {
                    if (ri.item() == null) continue;
                    if (ri.item().getId().equals(item.getId())) per = per.add(ri.perPortion());
                    else others = others.add(ri.perPortion().multiply(safe(ri.item().getUnitCost())));
                }
                if (per.signum() == 0) continue;
                BigDecimal netPrice = recipeService.netPrice(r);
                BigDecimal before = others.add(per.multiply(reference));
                BigDecimal after = others.add(per.multiply(newPrice));
                BigDecimal fcAfter = ratio(after, netPrice);
                if (fcAfter.compareTo(targetFoodCost) > 0) overTarget = true;
                impacts.add(String.format(Locale.forLanguageTag("tr-TR"), "%s %s%s ₺/porsiyon (food cost %%%s → %%%s%s)",
                        r.getName(), after.compareTo(before) >= 0 ? "+" : "", fmt(after.subtract(before)),
                        ratio(before, netPrice), fcAfter,
                        fcAfter.compareTo(targetFoodCost) > 0
                                ? ", önerilen fiyat " + fmt(suggestedPrice(after, recipeService.effectiveVatRate(r))) + " ₺" : ""));
            }
            boolean up = change.signum() > 0;
            String message = String.format(Locale.forLanguageTag("tr-TR"), "%s alış fiyatı %%%s %s (%s ₺ → %s ₺/%s).%s",
                    item.getName(), change.abs().toPlainString(), up ? "arttı" : "düştü", fmt(reference), fmt(newPrice), item.getUnit(),
                    impacts.isEmpty() ? " Bu kalemi kullanan reçete yok."
                            : " Etkilenen reçeteler: " + String.join("; ", impacts.subList(0, Math.min(4, impacts.size())))
                              + (impacts.size() > 4 ? " ve " + (impacts.size() - 4) + " reçete daha." : "."));
            notificationService.notify(List.of(AppRoles.MANAGER, AppRoles.ACCOUNTANT, AppRoles.CHEF),
                    (up ? "Maliyet Artışı: " : "Maliyet Düşüşü: ") + item.getName(), message,
                    "Fiyat İzleme", "PRICE_CHANGE", item.getId(), "/pricing", up && overTarget ? "WARNING" : "INFO");
        } catch (RuntimeException ex) {
            log.warn("Fiyat degisimi uyarisi uretilemedi ({}): {}", item != null ? item.getName() : "?", ex.getMessage());
        }
    }

    // ── Yardimcilar ────────────────────────────────────────────

    private String advice(String cls, String action, Map<String, Object> row) {
        if ("LOSS".equals(action)) {
            return "Fiyat; porsiyon maliyetini ve genel gider payını karşılamıyor. En az başabaş fiyatına (" + fmt((BigDecimal) row.get("breakEvenPrice"))
                    + " ₺) çıkarın veya reçeteyi yeniden maliyetlendirin.";
        }
        String base = switch (cls) {
            case STAR -> "Yıldız: çok satıyor ve kârlı. Kalitesini ve menüdeki yerini koruyun.";
            case PLOWHORSE -> "İş atı: çok satıyor ama katkı payı düşük. Fiyatı kademeli artırın veya porsiyon maliyetini düşürün.";
            case PUZZLE -> "Bulmaca: kârlı ama az satıyor. Menüde öne çıkarın, servis ekibine önerdirin.";
            case DOG -> "Zayıf: az satıyor ve katkı payı düşük. Menüden çıkarmayı veya yeniden tasarlamayı değerlendirin.";
            default -> "Bu dönemde satış verisi yok.";
        };
        if ("RAISE".equals(action)) {
            return base + " Food cost hedefin üzerinde; önerilen fiyat " + fmt((BigDecimal) row.get("suggestedPrice")) + " ₺.";
        }
        if ("WATCH".equals(action)) {
            return base + " Malzeme maliyeti dönem içinde %" + row.get("costChangePercent") + " arttı; fiyatı izleyin.";
        }
        return base;
    }

    private static Map<String, Object> alert(String severity, String title, String message, String route) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("severity", severity);
        a.put("title", title);
        a.put("message", message);
        a.put("route", route);
        return a;
    }

    private static int severityRank(String s) {
        return switch (s) { case "CRITICAL" -> 0; case "WARNING" -> 1; default -> 2; };
    }

    private static int actionRank(String a) {
        return switch (a) { case "LOSS" -> 0; case "RAISE" -> 1; case "WATCH" -> 2; default -> 3; };
    }

    /** Hedef food cost oranina gore KDV dahil satis fiyati; 5 TL'ye yukari yuvarlanir */
    BigDecimal suggestedPrice(BigDecimal cost, BigDecimal vat) {
        if (cost == null || cost.signum() <= 0 || targetFoodCost.signum() <= 0) return null;
        BigDecimal net = cost.multiply(HUNDRED).divide(targetFoodCost, 4, RoundingMode.HALF_UP);
        BigDecimal gross = grossOf(net, vat);
        return gross.divide(new BigDecimal("5"), 0, RoundingMode.CEILING).multiply(new BigDecimal("5")).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal grossOf(BigDecimal net, BigDecimal vat) {
        return net.multiply(HUNDRED.add(safe(vat))).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }

    static BigDecimal percentChange(BigDecimal from, BigDecimal to) {
        if (from == null || to == null || from.signum() == 0) return BigDecimal.ZERO;
        return to.subtract(from).multiply(HUNDRED).divide(from, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal ratio(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0 || part == null) return BigDecimal.ZERO;
        return part.multiply(HUNDRED).divide(whole, 1, RoundingMode.HALF_UP);
    }

    private static String signed(BigDecimal v) {
        return (v.signum() > 0 ? "+" : "") + v.toPlainString();
    }

    private static String fmt(BigDecimal v) {
        return ExpenseService.fmt(v);
    }

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
