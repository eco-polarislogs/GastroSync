package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;

/**
 * POS satis motoru.
 *
 *  - Fiyat, KDV ve maliyet sunucuda receteden hesaplanir; istemcinin gonderdigi fiyat yok sayilir.
 *  - Siparis atomiktir: tum kalemlerin hammaddesi yeterliyse stok dusulur, degilse hicbiri kaydedilmez.
 *  - Satir duzeyinde kilit (id sirali) ile es zamanli satislarda kayip guncelleme ve kilitlenme onlenir.
 *  - Satislar silinmez; gerekceli IPTAL stok iadesini ters kayitla (SALE_REVERSAL) yapar.
 */
@Service
@Transactional
public class SalesService {

    public static final String CASH = "CASH";
    public static final String CREDIT_CARD = "CREDIT_CARD";
    public static final String MEAL_CARD = "MEAL_CARD";
    /** Parcali odenen adisyon: yontem dagilimi check_payments satirlarindadir (yalnizca sistem icinde atanir) */
    public static final String MIXED = "MIXED";
    private static final DateTimeFormatter ORDER_TS = DateTimeFormatter.ofPattern("yyMMddHHmmss");

    private final SalesRecordRepository salesRepository;
    private final RecipeRepository recipeRepository;
    private final InventoryItemRepository inventoryRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final RecipeService recipeService;
    private final InventoryService inventoryService;
    private final AccountingPeriodService periodService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;

    public SalesService(SalesRecordRepository salesRepository,
                        RecipeRepository recipeRepository,
                        InventoryItemRepository inventoryRepository,
                        StockTransactionRepository stockTransactionRepository,
                        RecipeService recipeService,
                        InventoryService inventoryService,
                        AccountingPeriodService periodService,
                        NotificationService notificationService,
                        AuditService auditService,
                        CurrentUserService currentUserService) {
        this.salesRepository = salesRepository;
        this.recipeRepository = recipeRepository;
        this.inventoryRepository = inventoryRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.recipeService = recipeService;
        this.inventoryService = inventoryService;
        this.periodService = periodService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
    }

    public record OrderLine(Long recipeId, String productName, Integer quantity) {}

    // ── Sorgular ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SalesRecord> getAllSales() {
        return salesRepository.findAllByOrderBySoldAtDescIdDesc();
    }

    @Transactional(readOnly = true)
    public List<SalesRecord> getTodaySales() {
        LocalDateTime from = LocalDate.now().atStartOfDay();
        return salesRepository.findBySoldAtBetweenAndStatusOrderBySoldAtDesc(from, from.plusDays(1), SalesRecord.STATUS_COMPLETED);
    }

    @Transactional(readOnly = true)
    public List<SalesRecord> getSales(LocalDate from, LocalDate to, boolean includeVoided) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return includeVoided
                ? salesRepository.findBySoldAtBetweenOrderBySoldAtDesc(start, end)
                : salesRepository.findBySoldAtBetweenAndStatusOrderBySoldAtDesc(start, end, SalesRecord.STATUS_COMPLETED);
    }

    private static Specification<SalesRecord> rangeSpec(LocalDate from, LocalDate to, boolean includeVoided, String text, String method) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        Specification<SalesRecord> spec = (root, q, cb) -> cb.and(
                cb.greaterThanOrEqualTo(root.get("soldAt"), start), cb.lessThan(root.get("soldAt"), end));
        if (!includeVoided) spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), SalesRecord.STATUS_COMPLETED));
        if (method != null && !method.isBlank()) spec = spec.and((root, q, cb) -> cb.equal(root.get("paymentMethod"), method));
        if (text != null && !text.isBlank()) {
            String like = "%" + text.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("productName")), like),
                    cb.like(cb.lower(root.get("orderNo")), like),
                    cb.like(cb.lower(root.get("tableNo")), like)));
        }
        return spec;
    }

    @Transactional(readOnly = true)
    public PageResponse<SalesRecord> search(LocalDate from, LocalDate to, boolean includeVoided, String text,
                                            String method, Integer page, Integer size) {
        return search(from, to, includeVoided, text, method, page, size, null);
    }

    private static final Map<String, String> SORTABLE = Map.of(
            "soldAt", "soldAt", "productName", "productName", "quantity", "quantity", "totalPrice", "totalPrice",
            "tableNo", "tableNo", "paymentMethod", "paymentMethod", "orderNo", "orderNo", "status", "status");

    @Transactional(readOnly = true)
    public PageResponse<SalesRecord> search(LocalDate from, LocalDate to, boolean includeVoided, String text,
                                            String method, Integer page, Integer size, String rawSort) {
        Page<SalesRecord> result = salesRepository.findAll(rangeSpec(from, to, includeVoided, text, method),
                PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size),
                        PageResponse.sort(rawSort, SORTABLE, Sort.by(Sort.Order.desc("soldAt"), Sort.Order.desc("id")))));
        return PageResponse.of(result);
    }

    /** Tarih araligi ozeti: toplamlar, odeme turleri ve urun bazli kirilim (iptaller haric) */
    @Transactional(readOnly = true)
    public Map<String, Object> rangeSummary(LocalDate from, LocalDate to) {
        List<SalesRecord> all = salesRepository.findAll(rangeSpec(from, to, true, null, null));
        BigDecimal revenue = BigDecimal.ZERO, vat = BigDecimal.ZERO, cost = BigDecimal.ZERO;
        long voided = 0;
        Map<String, BigDecimal> byPayment = new TreeMap<>();
        Map<String, Map<String, Object>> byProduct = new LinkedHashMap<>();
        java.util.Set<String> orders = new java.util.HashSet<>();
        for (SalesRecord s : all) {
            if (s.isVoided()) { voided++; continue; }
            revenue = revenue.add(nz(s.getTotalPrice()));
            vat = vat.add(s.getVatAmount());
            cost = cost.add(s.getTotalCost());
            orders.add(s.getOrderNo());
            byPayment.merge(s.getPaymentMethod(), nz(s.getTotalPrice()), BigDecimal::add);
            Map<String, Object> p = byProduct.computeIfAbsent(s.getProductName(), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("recipeName", k);
                m.put("quantity", 0);
                m.put("revenue", BigDecimal.ZERO);
                m.put("vat", BigDecimal.ZERO);
                m.put("cost", BigDecimal.ZERO);
                return m;
            });
            p.put("quantity", (Integer) p.get("quantity") + s.getQuantity());
            p.put("revenue", ((BigDecimal) p.get("revenue")).add(nz(s.getTotalPrice())));
            p.put("vat", ((BigDecimal) p.get("vat")).add(s.getVatAmount()));
            p.put("cost", ((BigDecimal) p.get("cost")).add(s.getTotalCost()));
        }
        BigDecimal net = revenue.subtract(vat);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("from", from);
        r.put("to", to);
        r.put("revenue", revenue.setScale(2, RoundingMode.HALF_UP));
        r.put("vat", vat.setScale(2, RoundingMode.HALF_UP));
        r.put("net", net.setScale(2, RoundingMode.HALF_UP));
        r.put("cost", cost.setScale(2, RoundingMode.HALF_UP));
        r.put("grossProfit", net.subtract(cost).setScale(2, RoundingMode.HALF_UP));
        r.put("foodCostPercent", net.signum() > 0 ? cost.multiply(new BigDecimal("100")).divide(net, 1, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        r.put("orderCount", orders.size());
        r.put("voidedCount", voided);
        r.put("byPaymentMethod", byPayment);
        r.put("products", byProduct.values().stream()
                .sorted((a, b) -> ((BigDecimal) b.get("revenue")).compareTo((BigDecimal) a.get("revenue"))).toList());
        return r;
    }

    /** Bugunun satis ozeti (iptaller haric) */
    @Transactional(readOnly = true)
    public Map<String, Object> getSalesSummary() {
        List<SalesRecord> sales = getTodaySales();
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal vat = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        Map<String, BigDecimal> byPayment = new TreeMap<>();
        for (SalesRecord s : sales) {
            revenue = revenue.add(nz(s.getTotalPrice()));
            vat = vat.add(s.getVatAmount());
            cost = cost.add(s.getTotalCost());
            byPayment.merge(s.getPaymentMethod(), nz(s.getTotalPrice()), BigDecimal::add);
        }
        BigDecimal netRevenue = revenue.subtract(vat);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("scope", "TODAY");
        summary.put("date", LocalDate.now().toString());
        summary.put("totalRevenue", revenue.setScale(2, RoundingMode.HALF_UP));
        summary.put("netRevenue", netRevenue.setScale(2, RoundingMode.HALF_UP));
        summary.put("outputVat", vat.setScale(2, RoundingMode.HALF_UP));
        summary.put("totalCost", cost.setScale(2, RoundingMode.HALF_UP));
        summary.put("netProfit", netRevenue.subtract(cost).setScale(2, RoundingMode.HALF_UP));
        summary.put("foodCostPercent", netRevenue.signum() > 0
                ? cost.multiply(new BigDecimal("100")).divide(netRevenue, 1, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        summary.put("totalSalesCount", sales.size());
        summary.put("orderCount", sales.stream().map(SalesRecord::getOrderNo).distinct().count());
        summary.put("byPaymentMethod", byPayment);
        return summary;
    }

    // ── Satis ──────────────────────────────────────────────────

    /** Geriye donuk uyumlu tek satir satis (fiyat alanlari dikkate alinmaz) */
    public SalesRecord recordSale(SalesRecord input) {
        List<SalesRecord> created = recordOrder(input.getTableNo(), input.getPaymentMethod(), input.getOrderNo(),
                List.of(new OrderLine(input.getRecipeId(), input.getProductName(), input.getQuantity())));
        return created.get(0);
    }

    public List<SalesRecord> recordOrder(String tableNo, String paymentMethod, String orderNo, List<OrderLine> lines) {
        return recordCheckOrder(tableNo, paymentMethod, orderNo, lines, null, BigDecimal.ZERO);
    }

    /**
     * Adisyon tahsilati: ikram satirlari (compFlags) ucretsiz kaydedilir, onayli adisyon indirimi ucretli satirlara
     * tutarlariyla orantili dagitilir (KDV indirimli tutar uzerinden ayrilir). Stok ve maliyet her satirda islenir.
     * Yalnizca PosService (onay akisindan gecmis ikram / indirim) cagirir; REST siparis ucu ikram / indirim tasimaz.
     */
    public List<SalesRecord> recordCheckOrder(String tableNo, String paymentMethod, String orderNo, List<OrderLine> lines,
                                              List<Boolean> compFlags, BigDecimal discountTotal) {
        if (lines == null || lines.isEmpty()) {
            throw new IllegalArgumentException("Siparis en az bir kalem icermelidir");
        }
        if (lines.size() > 50) {
            throw new IllegalArgumentException("Bir sipariste en fazla 50 kalem olabilir");
        }
        periodService.assertOpen(Expense.periodOf(LocalDate.now()));
        String method = MIXED.equals(paymentMethod) ? MIXED : normalizePaymentMethod(paymentMethod);
        String table = tableNo == null || tableNo.isBlank() ? "Genel" : tableNo.trim();
        if (table.length() > 30) table = table.substring(0, 30);
        String order = orderNo != null && !orderNo.isBlank() ? orderNo.trim()
                : "S" + LocalDateTime.now().format(ORDER_TS) + String.format("%03d", ThreadLocalRandom.current().nextInt(1000));

        List<InventoryItem> allItems = inventoryRepository.findAll();

        // 1. Kalemleri cozumle ve toplam hammadde ihtiyacini hesapla
        record Planned(Recipe recipe, int qty, List<RecipeService.ResolvedIngredient> ingredients) {}
        List<Planned> plan = new ArrayList<>();
        Map<Long, BigDecimal> needs = new TreeMap<>();
        for (OrderLine line : lines) {
            Recipe recipe = resolveRecipe(line);
            int qty = line.quantity() == null ? 1 : line.quantity();
            if (qty < 1 || qty > 999) throw new IllegalArgumentException("Adet 1-999 arasinda olmalidir: " + recipe.getName());
            List<RecipeService.ResolvedIngredient> ings = recipeService.resolve(recipe, allItems, true);
            for (RecipeService.ResolvedIngredient ri : ings) {
                needs.merge(ri.item().getId(), ri.perPortion().multiply(BigDecimal.valueOf(qty)), BigDecimal::add);
            }
            plan.add(new Planned(recipe, qty, ings));
        }

        // 2. Ilgili stok kalemlerini id sirasiyla kilitle ve yeterliligi dogrula (hepsi ya da hicbiri)
        Map<Long, InventoryItem> locked = new HashMap<>();
        Map<Long, BigDecimal> before = new HashMap<>();
        List<String> shortages = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> need : needs.entrySet()) {
            InventoryItem item = inventoryService.lock(need.getKey());
            locked.put(item.getId(), item);
            before.put(item.getId(), nz(item.getCurrentStock()));
            if (nz(item.getCurrentStock()).compareTo(need.getValue()) < 0) {
                shortages.add(String.format("%s (gerekli %s %s, stok %s %s)", item.getName(),
                        need.getValue().setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString(), item.getUnit(),
                        nz(item.getCurrentStock()).stripTrailingZeros().toPlainString(), item.getUnit()));
            }
        }
        if (!shortages.isEmpty()) {
            throw new BusinessRuleException("Yetersiz stok nedeniyle satis yapilamadi: " + String.join("; ", shortages)
                    + ". Mal kabul veya sayim duzeltmesi sonrasi tekrar deneyin.");
        }

        // 3. Indirimi ucretli satirlara oransal dagit (kurus farki son ucretli satira)
        int n = plan.size();
        boolean[] comp = new boolean[n];
        BigDecimal[] gross = new BigDecimal[n];
        BigDecimal[] lineDiscount = new BigDecimal[n];
        BigDecimal paidGross = BigDecimal.ZERO;
        int lastPaid = -1;
        for (int i = 0; i < n; i++) {
            comp[i] = compFlags != null && i < compFlags.size() && Boolean.TRUE.equals(compFlags.get(i));
            gross[i] = plan.get(i).recipe().getSalePrice().setScale(2, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(plan.get(i).qty())).setScale(2, RoundingMode.HALF_UP);
            lineDiscount[i] = BigDecimal.ZERO;
            if (!comp[i]) { paidGross = paidGross.add(gross[i]); lastPaid = i; }
        }
        BigDecimal discount = discountTotal == null || discountTotal.signum() <= 0 ? BigDecimal.ZERO
                : discountTotal.setScale(2, RoundingMode.HALF_UP).min(paidGross);
        if (discount.signum() > 0 && paidGross.signum() > 0) {
            BigDecimal allocated = BigDecimal.ZERO;
            for (int i = 0; i < n; i++) {
                if (comp[i]) continue;
                BigDecimal share = i == lastPaid ? discount.subtract(allocated)
                        : gross[i].multiply(discount).divide(paidGross, 2, RoundingMode.HALF_UP);
                lineDiscount[i] = share;
                allocated = allocated.add(share);
            }
        }

        // 4. Satis satirlarini kaydet, stoktan dus ve maliyeti dondur
        String operator = currentUserService.username();
        String time = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
        List<SalesRecord> created = new ArrayList<>();
        for (int idx = 0; idx < n; idx++) {
            Planned p = plan.get(idx);
            BigDecimal unitPrice = p.recipe().getSalePrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal total = comp[idx] ? BigDecimal.ZERO.setScale(2) : gross[idx].subtract(lineDiscount[idx]);
            BigDecimal vatRate = recipeService.effectiveVatRate(p.recipe());
            BigDecimal vatAmount = total.multiply(vatRate).divide(vatRate.add(new BigDecimal("100")), 2, RoundingMode.HALF_UP);

            SalesRecord sale = new SalesRecord(order, time, p.recipe().getName(), p.qty(), unitPrice, total, table, method);
            sale.setRecipeId(p.recipe().getId());
            sale.setVatRate(vatRate);
            sale.setVatAmount(vatAmount);
            sale.setSoldAt(LocalDateTime.now());
            sale.setStatus(SalesRecord.STATUS_COMPLETED);
            sale.setRecordedBy(operator);
            if (comp[idx]) {
                sale.setComp(Boolean.TRUE);
                sale.setDiscountAmount(gross[idx]);
            } else if (lineDiscount[idx].signum() > 0) {
                sale.setDiscountAmount(lineDiscount[idx]);
            }
            sale = salesRepository.save(sale);

            BigDecimal lineCost = BigDecimal.ZERO;
            for (RecipeService.ResolvedIngredient ri : p.ingredients()) {
                InventoryItem item = locked.get(ri.item().getId());
                BigDecimal used = ri.perPortion().multiply(BigDecimal.valueOf(p.qty())).setScale(3, RoundingMode.HALF_UP);
                if (used.signum() <= 0) continue;
                BigDecimal unitCost = nz(item.getUnitCost());
                item.setCurrentStock(nz(item.getCurrentStock()).subtract(used));
                StockTransaction tx = new StockTransaction(item, StockTransaction.OUTBOUND_SALE, used, unitCost,
                        String.format("Satis tuketimi: %s x%d (Siparis %s)", p.recipe().getName(), p.qty(), order), operator);
                tx.setReferenceType("SALE");
                tx.setReferenceId(sale.getId());
                tx.setBalanceAfter(item.getCurrentStock());
                stockTransactionRepository.save(tx);
                lineCost = lineCost.add(tx.getTotalAmount());
            }
            sale.setTotalCost(lineCost.setScale(2, RoundingMode.HALF_UP));
            sale.setUnitCost(lineCost.divide(BigDecimal.valueOf(p.qty()), 2, RoundingMode.HALF_UP));
            created.add(salesRepository.save(sale));
        }
        for (InventoryItem item : locked.values()) {
            inventoryRepository.save(item);
            inventoryService.checkLowStock(item, before.get(item.getId()));
            inventoryService.publishInventoryChange(item);
        }

        BigDecimal orderTotal = created.stream().map(SalesRecord::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        auditService.log("SALE_CREATED", "SALE", created.get(0).getId(), null, SalesRecord.STATUS_COMPLETED,
                String.format("Siparis %s | %d kalem | %s TL | %s | %s", order, created.size(), orderTotal.toPlainString(), method, table));
        notificationService.publish("/topic/finance", Map.of("type", "SALE", "orderNo", order));
        return created;
    }

    private Recipe resolveRecipe(OrderLine line) {
        if (line.recipeId() != null) {
            return recipeRepository.findById(line.recipeId())
                    .orElseThrow(() -> new IllegalArgumentException("Menude olmayan urun: #" + line.recipeId()));
        }
        if (line.productName() == null || line.productName().isBlank()) {
            throw new IllegalArgumentException("Satilan urun belirtilmelidir");
        }
        return recipeRepository.findFirstByNameIgnoreCase(line.productName().trim())
                .orElseThrow(() -> new IllegalArgumentException("Menude olmayan urun satilamaz: " + line.productName()));
    }

    // ── Iptal ──────────────────────────────────────────────────

    public SalesRecord voidSale(Long saleId, String reason) {
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.length() < 5) {
            throw new IllegalArgumentException("Iptal gerekcesi zorunludur (en az 5 karakter)");
        }
        SalesRecord sale = salesRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Satis kaydi bulunamadi"));
        if (sale.isVoided()) {
            throw new BusinessRuleException("Bu satis zaten iptal edilmis");
        }
        LocalDate soldDate = sale.getSoldAt() != null ? sale.getSoldAt().toLocalDate() : LocalDate.now();
        periodService.assertOpen(Expense.periodOf(soldDate));

        List<StockTransaction> outs = stockTransactionRepository.findByReferenceTypeAndReferenceIdAndType(
                "SALE", saleId, StockTransaction.OUTBOUND_SALE);
        String operator = currentUserService.username();
        outs.stream().sorted((a, b) -> a.getItem().getId().compareTo(b.getItem().getId())).forEach(out -> {
            InventoryItem item = inventoryService.lock(out.getItem().getId());
            item.setCurrentStock(nz(item.getCurrentStock()).add(out.getQuantity()));
            inventoryRepository.save(item);
            StockTransaction rev = new StockTransaction(item, StockTransaction.SALE_REVERSAL, out.getQuantity(), out.getUnitCost(),
                    "Satis iptali iadesi (Siparis " + sale.getOrderNo() + "): " + cleanReason, operator);
            rev.setTotalAmount(out.getTotalAmount());
            rev.setReferenceType("SALE");
            rev.setReferenceId(saleId);
            rev.setBalanceAfter(item.getCurrentStock());
            stockTransactionRepository.save(rev);
            inventoryService.publishInventoryChange(item);
        });

        sale.setStatus(SalesRecord.STATUS_VOIDED);
        sale.setVoidReason(cleanReason);
        sale.setVoidedBy(currentUserService.displayName());
        sale.setVoidedAt(LocalDateTime.now());
        SalesRecord saved = salesRepository.save(sale);

        auditService.log("SALE_VOIDED", "SALE", saleId, SalesRecord.STATUS_COMPLETED, SalesRecord.STATUS_VOIDED,
                String.format("%s x%d | %s TL | %s", sale.getProductName(), sale.getQuantity(), sale.getTotalPrice(), cleanReason));
        // Iptali yapan kisi disinda en az bir kontrol gozu: Muhasebe (kasa mutabakati) ve Yonetici (isletme sahibi)
        notificationService.notify(List.of(AppRoles.MANAGER, AppRoles.ACCOUNTANT, AppRoles.ADMIN),
                "Satis Iptali: " + sale.getProductName(),
                String.format("%s, %s siparisindeki %s x%d (%s TL) satisini iptal etti. Gerekce: %s",
                        currentUserService.displayName(), sale.getOrderNo(), sale.getProductName(), sale.getQuantity(),
                        ExpenseService.fmt(sale.getTotalPrice()), cleanReason),
                currentUserService.displayName(), "SALE_VOID", saleId, "/sales", "WARNING");
        notificationService.publish("/topic/finance", Map.of("type", "SALE", "id", saleId));
        return saved;
    }

    // ── Yardimcilar ────────────────────────────────────────────

    public static String normalizePaymentMethod(String raw) {
        if (raw == null || raw.isBlank()) return CREDIT_CARD;
        String m = raw.trim().toUpperCase(Locale.forLanguageTag("tr")).replace('İ', 'I');
        if (m.equals(CASH) || m.contains("NAKIT")) return CASH;
        if (m.equals(MEAL_CARD) || m.contains("YEMEK") || m.contains("MEAL") || m.contains("SODEXO")
                || m.contains("MULTINET") || m.contains("TICKET") || m.contains("SETCARD")) return MEAL_CARD;
        if (m.equals(CREDIT_CARD) || m.contains("KART") || m.contains("CARD") || m.contains("POS")) return CREDIT_CARD;
        throw new IllegalArgumentException("Gecersiz odeme yontemi: " + raw + " (CASH, CREDIT_CARD, MEAL_CARD)");
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
