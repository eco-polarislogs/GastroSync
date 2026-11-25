package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Stok ve envanter yonetimi.
 *
 * Muhasebe ilkeleri:
 *  - Stok miktari yalnizca degistirilemez hareketlerle degisir (stok defteri).
 *  - Maliyet yontemi: Agirlikli Ortalama Maliyet (TMS 2 / VUK 274). Mal kabulde alis fiyati
 *    girilirse ortalama birim maliyet yeniden hesaplanir.
 *  - Stoktan fazla fire yazilamaz; sayim farklari ADJUSTMENT hareketi ile gerekceli kaydedilir.
 *  - Kritik seviyeye dusen kalemler icin depo, mutfak ve yonetime bildirim gonderilir.
 */
@Service
@Transactional
public class InventoryService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final InventoryItemRepository itemRepository;
    private final StockTransactionRepository transactionRepository;
    private final RecipeRepository recipeRepository;
    private final ExpenseRepository expenseRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final PricingService pricingService;

    /**
     * Sayim farki onay esigi: fark %count-approval-percent'i VE count-approval-min-amount TL'yi birlikte asarsa
     * ya da tek basina count-approval-amount TL'yi asarsa Mudur onayi gerekir (kucuk farklar dogrudan islenir).
     */
    @Value("${gastrosync.inventory.count-approval-percent:5}")
    private BigDecimal countApprovalPercent = new BigDecimal("5");
    @Value("${gastrosync.inventory.count-approval-min-amount:250}")
    private BigDecimal countApprovalMinAmount = new BigDecimal("250");
    @Value("${gastrosync.inventory.count-approval-amount:1000}")
    private BigDecimal countApprovalAmount = new BigDecimal("1000");

    public InventoryService(InventoryItemRepository itemRepository,
                            StockTransactionRepository transactionRepository,
                            RecipeRepository recipeRepository,
                            ExpenseRepository expenseRepository,
                            NotificationService notificationService,
                            AuditService auditService,
                            CurrentUserService currentUserService,
                            PricingService pricingService) {
        this.itemRepository = itemRepository;
        this.transactionRepository = transactionRepository;
        this.recipeRepository = recipeRepository;
        this.expenseRepository = expenseRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.pricingService = pricingService;
    }

    // ── Sorgular ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<InventoryItem> getAllItems() {
        return itemRepository.findAllByOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public Optional<InventoryItem> getItemById(Long id) {
        return itemRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<InventoryItem> getItemByBarcode(String barcode) {
        return itemRepository.findFirstByBarcodeOrderByIdAsc(barcode == null ? null : barcode.trim());
    }

    @Transactional(readOnly = true)
    public List<StockTransaction> getRecentTransactions() {
        return transactionRepository.findRecentTransactions(PageRequest.of(0, 150));
    }

    @Transactional(readOnly = true)
    public List<StockTransaction> getItemTransactions(Long itemId) {
        return transactionRepository.findByItemIdOrderByTimestampDesc(itemId, PageRequest.of(0, 200));
    }

    /** Sayfali stok hareket defteri (tip, kalem ve metin filtresi) */
    @Transactional(readOnly = true)
    public PageResponse<StockTransaction> transactionsPage(String type, Long itemId, String text, Integer page, Integer size) {
        return transactionsPage(type, itemId, text, page, size, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<StockTransaction> transactionsPage(String type, Long itemId, String text, Integer page, Integer size,
                                                           String sort) {
        Specification<StockTransaction> spec = (root, q, cb) -> cb.conjunction();
        if (type != null && !type.isBlank()) {
            String t = type.trim().toUpperCase(Locale.ROOT);
            spec = spec.and((root, q, cb) -> cb.equal(root.get("type"), t));
        }
        if (itemId != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("item").get("id"), itemId));
        if (text != null && !text.isBlank()) {
            String like = "%" + text.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("item").get("name")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("reason"), "")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("recordedBy"), "")), like)));
        }
        Page<StockTransaction> result = transactionRepository.findAll(spec, PageRequest.of(PageResponse.clampPage(page),
                PageResponse.clampSize(size), PageResponse.sort(sort, Map.of(
                        "timestamp", "timestamp", "type", "type", "quantity", "quantity", "itemName", "item.name",
                        "totalAmount", "totalAmount", "recordedBy", "recordedBy"),
                        Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("id")))));
        return PageResponse.of(result);
    }

    @Transactional(readOnly = true)
    public List<StockTransaction> getWasteRecords() {
        return transactionRepository.findAllWasteRecords();
    }

    /** Envanter degerlemesi (miktar x agirlikli ortalama maliyet) */
    @Transactional(readOnly = true)
    public Map<String, Object> getValuation() {
        List<InventoryItem> items = itemRepository.findAll();
        BigDecimal total = BigDecimal.ZERO;
        Map<String, BigDecimal> byCategory = new TreeMap<>();
        long critical = 0;
        for (InventoryItem i : items) {
            BigDecimal value = safe(i.getCurrentStock()).multiply(safe(i.getUnitCost())).setScale(2, RoundingMode.HALF_UP);
            total = total.add(value);
            byCategory.merge(i.getCategory() == null ? "Diger" : i.getCategory(), value, BigDecimal::add);
            if (isCritical(i)) critical++;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalValue", total.setScale(2, RoundingMode.HALF_UP));
        result.put("byCategory", byCategory);
        result.put("itemCount", items.size());
        result.put("criticalStockCount", critical);
        result.put("costingMethod", "WEIGHTED_AVERAGE");
        return result;
    }

    public static boolean isCritical(InventoryItem i) {
        return safe(i.getCurrentStock()).compareTo(safe(i.getMinStock())) <= 0;
    }

    // ── Stok karti ─────────────────────────────────────────────

    public InventoryItem createItem(InventoryItemRequest req) {
        String barcode = blankToNull(req.getBarcode());
        if (barcode != null && itemRepository.existsByBarcode(barcode)) {
            throw new BusinessRuleException("Bu barkod baska bir stok kalemine ait: " + barcode);
        }
        if (itemRepository.existsByNameIgnoreCase(req.getName().trim())) {
            throw new BusinessRuleException("Ayni isimde stok kalemi zaten var: " + req.getName().trim());
        }
        InventoryItem item = new InventoryItem(
                req.getName().trim(),
                req.getCategory().trim(),
                BigDecimal.ZERO,
                safe(req.getMinStock()),
                req.getUnit().trim(),
                safe(req.getUnitCost()).setScale(2, RoundingMode.HALF_UP),
                req.getSupplier() == null || req.getSupplier().isBlank() ? "-" : req.getSupplier().trim(),
                barcode,
                LocalDateTime.now().format(TS));
        InventoryItem saved = itemRepository.save(item);

        BigDecimal opening = safe(req.getCurrentStock());
        if (opening.signum() > 0) {
            saved.setCurrentStock(opening);
            itemRepository.save(saved);
            StockTransaction tx = new StockTransaction(saved, StockTransaction.INBOUND, opening, saved.getUnitCost(),
                    "Acilis stogu", currentUserService.username());
            tx.setBalanceAfter(opening);
            transactionRepository.save(tx);
        }
        auditService.log("INVENTORY_ITEM_CREATED", "INVENTORY", saved.getId(), null, null,
                saved.getName() + " | birim maliyet " + saved.getUnitCost() + " | acilis " + opening + " " + saved.getUnit());
        publishInventoryChange(saved);
        return saved;
    }

    public InventoryItem updateItem(Long id, InventoryItemRequest req) {
        InventoryItem item = itemRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Guncellenecek urun bulunamadi"));

        String barcode = blankToNull(req.getBarcode());
        if (barcode != null && itemRepository.existsByBarcodeAndIdNot(barcode, id)) {
            throw new BusinessRuleException("Bu barkod baska bir stok kalemine ait: " + barcode);
        }

        BigDecimal newCost = req.getUnitCost() != null ? req.getUnitCost().setScale(2, RoundingMode.HALF_UP) : item.getUnitCost();
        if (newCost.compareTo(safe(item.getUnitCost())) != 0) {
            if (!currentUserService.can(Permissions.P.INVENTORY_COST_EDIT)) {
                throw new AccessDeniedException("Birim maliyet duzeltmesi yalnizca Muhasebe yetkisindedir");
            }
            auditService.log("UNIT_COST_CHANGED", "INVENTORY", id, item.getUnitCost().toPlainString(), newCost.toPlainString(),
                    item.getName() + " birim maliyeti elle duzeltildi");
            item.setUnitCost(newCost);
        }

        String newSupplier = req.getSupplier() == null || req.getSupplier().isBlank() ? "-" : req.getSupplier().trim();
        boolean cardChanged = !req.getName().trim().equals(item.getName())
                || !req.getCategory().trim().equals(item.getCategory())
                || safe(req.getMinStock()).compareTo(safe(item.getMinStock())) != 0
                || !req.getUnit().trim().equals(item.getUnit())
                || !newSupplier.equals(item.getSupplier())
                || !java.util.Objects.equals(barcode, item.getBarcode());
        // Stok karti bilgileri Depo isidir; Muhasebe yalnizca birim maliyeti duzeltebilir
        if (cardChanged && !currentUserService.can(Permissions.P.INVENTORY_ITEM_MANAGE)) {
            throw new AccessDeniedException("Stok karti bilgilerini yalnizca Depo Sorumlusu degistirebilir");
        }

        item.setName(req.getName().trim());
        item.setCategory(req.getCategory().trim());
        item.setMinStock(safe(req.getMinStock()));
        item.setUnit(req.getUnit().trim());
        item.setSupplier(newSupplier);
        item.setBarcode(barcode);
        item.setLastUpdated(LocalDateTime.now().format(TS));
        InventoryItem saved = itemRepository.save(item);
        publishInventoryChange(saved);
        return saved;
    }

    public void deleteItem(Long id) {
        InventoryItem item = itemRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Urun bulunamadi"));
        if (safe(item.getCurrentStock()).signum() != 0) {
            throw new BusinessRuleException("Stokta miktar bulunan kalem silinemez. Once sayim duzeltmesi veya fire ile sifirlayin.");
        }
        for (Recipe r : recipeRepository.findAll()) {
            String json = r.getIngredientsJson();
            if (json != null && (json.contains("\"itemId\":" + id + ",") || json.contains("\"itemId\":" + id + "}")
                    || json.toLowerCase(Locale.ROOT).contains("\"" + item.getName().toLowerCase(Locale.ROOT) + "\""))) {
                throw new BusinessRuleException("Bu kalem '" + r.getName() + "' recetesinde kullaniliyor; once receteyi guncelleyin.");
            }
        }
        item.markDeleted(currentUserService.username());
        itemRepository.save(item);
        itemRepository.delete(item);
        auditService.log("INVENTORY_ITEM_DELETED", "INVENTORY", id, null, null, item.getName());
        notificationService.publish("/topic/inventory", Map.of("type", "DELETED", "id", id));
    }

    // ── Stok hareketleri ───────────────────────────────────────

    public StockTransaction receiveStock(Long itemId, BigDecimal quantity, String recordedBy) {
        return receiveStock(itemId, quantity, null, null, null);
    }

    /**
     * Mal kabul. purchaseUnitCost verilirse agirlikli ortalama maliyet guncellenir.
     */
    public StockTransaction receiveStock(Long itemId, BigDecimal quantity, BigDecimal purchaseUnitCost,
                                         String documentNo, Long expenseId) {
        requirePositive(quantity, "Giris miktari 0'dan buyuk olmalidir");
        Expense purchase = null;
        if (expenseId != null) {
            purchase = expenseRepository.findByIdForUpdate(expenseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tedarik kaydi bulunamadi: " + expenseId));
            if (purchase.getInventoryItemId() == null || !purchase.getInventoryItemId().equals(itemId)) {
                throw new BusinessRuleException("Bu tedarik kaydi secilen stok kalemine ait degil");
            }
            if (Expense.STATUS_REJECTED.equals(purchase.getStatus())) {
                throw new BusinessRuleException("Reddedilmis tedarik kaydina mal kabul yapilamaz");
            }
        }
        InventoryItem item = lock(itemId);
        BigDecimal before = safe(item.getCurrentStock());
        BigDecimal oldCost = safe(item.getUnitCost());
        BigDecimal txCost = oldCost;
        // Fiyat degisimi uyarisi icin onceki alis fiyati (yoksa ortalama maliyet referans alinir)
        BigDecimal previousPurchase = purchaseUnitCost == null ? null
                : transactionRepository.findFirstByItem_IdAndTypeOrderByTimestampDescIdDesc(itemId, StockTransaction.INBOUND)
                        .map(StockTransaction::getUnitCost).filter(c -> c != null && c.signum() > 0).orElse(null);

        if (purchaseUnitCost != null) {
            if (purchaseUnitCost.signum() < 0) {
                throw new IllegalArgumentException("Alis birim fiyati negatif olamaz");
            }
            txCost = purchaseUnitCost.setScale(2, RoundingMode.HALF_UP);
            BigDecimal newAvg = before.signum() <= 0
                    ? txCost
                    : before.multiply(oldCost).add(quantity.multiply(txCost))
                            .divide(before.add(quantity), 2, RoundingMode.HALF_UP);
            item.setUnitCost(newAvg);
        }
        BigDecimal after = before.add(quantity);
        item.setCurrentStock(after);
        item.setLastUpdated(LocalDateTime.now().format(TS));
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction(item, StockTransaction.INBOUND, quantity, txCost,
                documentNo != null && !documentNo.isBlank() ? "Mal Kabul (Belge: " + documentNo.trim() + ")" : "Mal Kabul",
                currentUserService.username());
        tx.setBalanceAfter(after);
        tx.setDocumentNo(blankToNull(documentNo));
        if (expenseId != null) {
            tx.setReferenceType("EXPENSE");
            tx.setReferenceId(expenseId);
        }
        StockTransaction saved = transactionRepository.save(tx);
        if (purchase != null) {
            purchase.setDeliveredQuantity(purchase.getDeliveredQuantity().add(quantity));
            expenseRepository.save(purchase);
            notificationService.publish("/topic/finance", Map.of("type", "EXPENSE", "id", purchase.getId()));
        }
        publishInventoryChange(item);
        if (purchaseUnitCost != null) {
            pricingService.onPurchasePrice(item, previousPurchase != null ? previousPurchase : oldCost, txCost);
        }
        return saved;
    }

    /**
     * Depoya beklenen teslimatlar: stok kalemine bagli, reddedilmemis hammadde alim kayitlarindan
     * teslim alinan miktari siparis miktarindan az olanlar. Depo personeline yalnizca operasyon icin
     * gereken alanlar dondurulur (mali ayrintilar gizlenir).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPendingDeliveries() {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (Expense e : expenseRepository.findBySubTypeInAndInventoryItemIdIsNotNullAndStatusInOrderByDueDateAsc(
                List.of("RAW_MATERIAL", "FOOD_SUPPLY"),
                List.of(Expense.STATUS_PENDING, Expense.STATUS_APPROVED, Expense.STATUS_FINALIZED))) {
            BigDecimal ordered = safe(e.getPurchaseQuantity());
            BigDecimal delivered = e.getDeliveredQuantity();
            if (ordered.signum() <= 0 || delivered.compareTo(ordered) >= 0) continue;
            InventoryItem item = itemRepository.findById(e.getInventoryItemId()).orElse(null);
            if (item == null) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("expenseId", e.getId());
            row.put("itemId", item.getId());
            row.put("itemName", item.getName());
            row.put("unit", item.getUnit());
            row.put("orderedQuantity", ordered);
            row.put("deliveredQuantity", delivered);
            row.put("remainingQuantity", ordered.subtract(delivered));
            row.put("supplier", e.getCounterparty() != null ? e.getCounterparty() : item.getSupplier());
            row.put("invoiceNumber", e.getInvoiceNumber());
            row.put("approvalStatus", e.getStatus());
            row.put("paymentStatus", e.getPaymentStatus());
            row.put("dueDate", e.getDueDate());
            row.put("requestedBy", e.getRecordedBy());
            out.add(row);
        }
        return out;
    }

    public StockTransaction recordWaste(Long itemId, BigDecimal quantity, String reason, String recordedBy) {
        requirePositive(quantity, "Zayiat miktari 0'dan buyuk olmalidir");
        String cleanReason = reason == null || reason.isBlank() ? null : reason.trim();
        if (cleanReason == null || cleanReason.length() < 3) {
            throw new IllegalArgumentException("Fire / zayiat nedeni belirtilmelidir");
        }
        InventoryItem item = lock(itemId);
        BigDecimal before = safe(item.getCurrentStock());
        if (quantity.compareTo(before) > 0) {
            throw new BusinessRuleException(String.format(
                    "Fire miktari (%s %s) mevcut stoktan (%s %s) fazla olamaz. Fark varsa sayim duzeltmesi yapin.",
                    quantity.stripTrailingZeros().toPlainString(), item.getUnit(),
                    before.stripTrailingZeros().toPlainString(), item.getUnit()));
        }
        BigDecimal after = before.subtract(quantity);
        item.setCurrentStock(after);
        item.setLastUpdated(LocalDateTime.now().format(TS));
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction(item, StockTransaction.WASTE, quantity, safe(item.getUnitCost()),
                cleanReason, currentUserService.username());
        tx.setBalanceAfter(after);
        StockTransaction saved = transactionRepository.save(tx);
        checkLowStock(item, before);
        publishInventoryChange(item);
        return saved;
    }

    /** Sayim degerlendirmesi: sistem stoku, fark, farkin TL degeri ve yuzdesi, onay gerekip gerekmedigi */
    public record CountEvaluation(InventoryItem item, BigDecimal systemQuantity, BigDecimal delta, BigDecimal value,
                                  BigDecimal percent, boolean requiresApproval) {}

    @Transactional(readOnly = true)
    public CountEvaluation evaluateCount(Long itemId, BigDecimal countedQuantity) {
        if (countedQuantity == null || countedQuantity.signum() < 0) {
            throw new IllegalArgumentException("Sayilan miktar 0 veya daha buyuk olmalidir");
        }
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Urun bulunamadi: ID " + itemId));
        BigDecimal before = safe(item.getCurrentStock());
        BigDecimal delta = countedQuantity.subtract(before);
        if (delta.signum() == 0) {
            throw new BusinessRuleException("Sayilan miktar sistemdeki stokla ayni; duzeltme gerekmiyor");
        }
        BigDecimal value = delta.abs().multiply(safe(item.getUnitCost())).setScale(2, RoundingMode.HALF_UP);
        BigDecimal percent = before.signum() == 0 ? new BigDecimal("100")
                : delta.abs().multiply(new BigDecimal("100")).divide(before, 2, RoundingMode.HALF_UP);
        return new CountEvaluation(item, before, delta, value, percent, requiresCountApproval(value, percent));
    }

    public boolean requiresCountApproval(BigDecimal value, BigDecimal percent) {
        return value.compareTo(countApprovalAmount) >= 0
                || (percent.compareTo(countApprovalPercent) > 0 && value.compareTo(countApprovalMinAmount) >= 0);
    }

    public String countApprovalRule() {
        return String.format("fark %%%s ve %s TL'yi birlikte veya tek basina %s TL'yi asarsa",
                countApprovalPercent.stripTrailingZeros().toPlainString(), countApprovalMinAmount.stripTrailingZeros().toPlainString(),
                countApprovalAmount.stripTrailingZeros().toPlainString());
    }

    /**
     * Fiziki sayim sonucu: fark ADJUSTMENT hareketi (isaretli miktar) olarak kaydedilir.
     * Esigi asan fark Mudur onayi olmadan islenmez (onay talebi ApprovalService ile acilir).
     */
    public StockTransaction adjustToCount(Long itemId, BigDecimal countedQuantity, String reason) {
        if (countedQuantity == null || countedQuantity.signum() < 0) {
            throw new IllegalArgumentException("Sayilan miktar 0 veya daha buyuk olmalidir");
        }
        String why = requireCountReason(reason);
        InventoryItem item = lock(itemId);
        BigDecimal before = safe(item.getCurrentStock());
        BigDecimal delta = countedQuantity.subtract(before);
        if (delta.signum() == 0) {
            throw new BusinessRuleException("Sayilan miktar sistemdeki stokla ayni; duzeltme gerekmiyor");
        }
        BigDecimal value = delta.abs().multiply(safe(item.getUnitCost())).setScale(2, RoundingMode.HALF_UP);
        BigDecimal percent = before.signum() == 0 ? new BigDecimal("100")
                : delta.abs().multiply(new BigDecimal("100")).divide(before, 2, RoundingMode.HALF_UP);
        if (requiresCountApproval(value, percent) && !currentUserService.can(Permissions.P.INVENTORY_ADJUST_APPROVE)) {
            throw new BusinessRuleException("Sayim farki onay esigini asiyor (" + countApprovalRule()
                    + "); fark Isletme Muduru onayina gonderilmelidir");
        }
        return writeAdjustment(item, before, countedQuantity, delta, why, currentUserService.username(), null);
    }

    /**
     * Onaylanan sayim farkini uygular. Fark, sayim anindaki sistem stokuna gore hesaplanmistir; onay beklerken
     * yapilan satislar stogu degistirmis olabilecegi icin mutlak miktar degil FARK uygulanir (stok eksiye dusmez).
     */
    public StockTransaction applyApprovedCount(Long itemId, BigDecimal delta, String reason, String countedBy, String approvedBy) {
        InventoryItem item = lock(itemId);
        BigDecimal before = safe(item.getCurrentStock());
        BigDecimal after = before.add(delta).max(BigDecimal.ZERO);
        BigDecimal applied = after.subtract(before);
        if (applied.signum() == 0) {
            throw new BusinessRuleException("Uygulanacak sayim farki kalmadi (stok zaten 0)");
        }
        return writeAdjustment(item, before, after, applied, reason, countedBy, approvedBy);
    }

    public static String requireCountReason(String reason) {
        if (reason == null || reason.trim().length() < 3) {
            throw new IllegalArgumentException("Sayim duzeltmesi icin aciklama zorunludur");
        }
        String why = reason.trim();
        return why.length() > 200 ? why.substring(0, 200) : why;
    }

    private StockTransaction writeAdjustment(InventoryItem item, BigDecimal before, BigDecimal after, BigDecimal delta,
                                             String reason, String recordedBy, String approvedBy) {
        item.setCurrentStock(after);
        item.setLastUpdated(LocalDateTime.now().format(TS));
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction(item, StockTransaction.ADJUSTMENT, delta, safe(item.getUnitCost()),
                "Sayim farki: " + reason + (approvedBy != null ? " (Onay: " + approvedBy + ")" : ""), recordedBy);
        tx.setBalanceAfter(after);
        tx.setReferenceType("COUNT");
        StockTransaction saved = transactionRepository.save(tx);

        BigDecimal value = delta.multiply(safe(item.getUnitCost())).setScale(2, RoundingMode.HALF_UP);
        auditService.log("STOCK_COUNT_ADJUSTED", "INVENTORY", item.getId(), before.toPlainString(), after.toPlainString(),
                item.getName() + " sayim farki " + delta.toPlainString() + " " + item.getUnit() + " (" + value + " TL)"
                        + (approvedBy != null ? " | Sayan: " + recordedBy + " | Onay: " + approvedBy : ""));
        // Onayli farkta Mudur zaten karar verdi; Muhasebe stok degerindeki degisiklikten haberdar edilir
        notificationService.notify(approvedBy != null ? List.of(AppRoles.ACCOUNTANT) : List.of(AppRoles.MANAGER, AppRoles.ACCOUNTANT),
                "Sayim Farki: " + item.getName(),
                String.format("%s sayiminda %s %s fark (%s TL) kaydedildi%s. Aciklama: %s",
                        item.getName(), delta.stripTrailingZeros().toPlainString(), item.getUnit(), value.toPlainString(),
                        approvedBy != null ? " (Mudur onayi: " + approvedBy + ")" : "", reason),
                currentUserService.displayName(), "INVENTORY_ADJUSTMENT", item.getId(), "/inventory",
                delta.signum() < 0 ? "WARNING" : "INFO");
        checkLowStock(item, before);
        publishInventoryChange(item);
        return saved;
    }

    // ── Yardimcilar ────────────────────────────────────────────

    public InventoryItem lock(Long itemId) {
        return itemRepository.findByIdForUpdate(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Urun bulunamadi: ID " + itemId));
    }

    /** Stok, minimum seviyenin uzerinden kritik seviyeye indiginde bildirim uretir */
    public void checkLowStock(InventoryItem item, BigDecimal before) {
        BigDecimal min = safe(item.getMinStock());
        if (before.compareTo(min) > 0 && safe(item.getCurrentStock()).compareTo(min) <= 0) {
            notificationService.notify(List.of(AppRoles.WAREHOUSE, AppRoles.CHEF, AppRoles.MANAGER),
                    "Kritik Stok: " + item.getName(),
                    String.format("%s stogu %s %s seviyesine dustu (minimum: %s %s). Tedarik talebi acilmasi onerilir.",
                            item.getName(), safe(item.getCurrentStock()).stripTrailingZeros().toPlainString(), item.getUnit(),
                            min.stripTrailingZeros().toPlainString(), item.getUnit()),
                    "Stok Takip Sistemi", "INVENTORY_LOW", item.getId(), "/inventory", "WARNING");
        }
    }

    public void publishInventoryChange(InventoryItem item) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "UPDATED");
        payload.put("id", item.getId());
        payload.put("currentStock", item.getCurrentStock());
        payload.put("unitCost", item.getUnitCost());
        notificationService.publish("/topic/inventory", payload);
    }

    private static void requirePositive(BigDecimal v, String message) {
        if (v == null || v.signum() <= 0) throw new IllegalArgumentException(message);
        if (v.compareTo(new BigDecimal("1000000")) > 0) throw new IllegalArgumentException("Miktar makul sinirlarin uzerinde");
    }

    static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
