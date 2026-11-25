package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.ApprovalRequest;
import com.gastrosync.model.CheckItem;
import com.gastrosync.model.CheckPayment;
import com.gastrosync.model.DiningTable;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.TableCheck;
import com.gastrosync.repository.ApprovalRequestRepository;
import com.gastrosync.repository.CheckItemRepository;
import com.gastrosync.repository.CheckPaymentRepository;
import com.gastrosync.repository.DiningTableRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.TableCheckRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Masa ve adisyon yonetimi (Kasa Sorumlusu).
 *
 *  - Her masanin benzersiz bir numarasi vardir; adisyon masaya acilir.
 *  - Masaya giden her yemek / icecek adisyon kalemi olarak kaydedilir ve mutfak ekranina duser.
 *  - Kalem eklenirken stok yeterliligi, acik adisyonlarin ayirdigi miktarlar da dikkate alinarak dogrulanir.
 *  - Musteri kasada masa numarasini soyler; tahsilat alininca kalemler satis kaydina (gelir) donusur,
 *    recete malzemeleri stoktan duser, KDV ayrilir ve yevmiyeye yansir (SalesService uzerinden, atomik).
 *  - Iptaller gerekcelidir; hazirlanmaya baslamis kalemi yalnizca Mudur iptal edebilir. Kasiyer bunun icin
 *    (ve ikram / indirim icin) Mudure onay talebi gonderir (ApprovalService); onaylanan islem burada uygulanir.
 *  - Ikram edilen kalem ucretsizdir ama stok ve maliyet islenir; indirim tahsilatta ucretli satirlara dagitilir.
 */
@Service
@Transactional
public class PosService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Set<String> KITCHEN_ACTIVE = Set.of(CheckItem.ORDERED, CheckItem.PREPARING, CheckItem.READY);

    private final DiningTableRepository tableRepository;
    private final TableCheckRepository checkRepository;
    private final CheckItemRepository itemRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeService recipeService;
    private final InventoryItemRepository inventoryRepository;
    private final SalesService salesService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final ApprovalRequestRepository approvalRepository;
    private final CheckPaymentRepository paymentRepository;
    /** Mutfak / bar fisi (yazici tanimli degilse islem yapmaz; hata siparisi engellemez) */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.gastrosync.service.print.PrintService printService;

    public PosService(DiningTableRepository tableRepository, TableCheckRepository checkRepository,
                      CheckItemRepository itemRepository, RecipeRepository recipeRepository, RecipeService recipeService,
                      InventoryItemRepository inventoryRepository, SalesService salesService,
                      NotificationService notificationService, AuditService auditService,
                      CurrentUserService currentUserService, ApprovalRequestRepository approvalRepository,
                      CheckPaymentRepository paymentRepository) {
        this.tableRepository = tableRepository;
        this.checkRepository = checkRepository;
        this.itemRepository = itemRepository;
        this.recipeRepository = recipeRepository;
        this.recipeService = recipeService;
        this.inventoryRepository = inventoryRepository;
        this.salesService = salesService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.approvalRepository = approvalRepository;
        this.paymentRepository = paymentRepository;
    }

    public record ItemInput(Long recipeId, Integer quantity, String note) {}

    // ── Masalar ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> tables() {
        List<DiningTable> tables = tableRepository.findAllByOrderByNumberAsc();
        Map<Long, TableCheck> openByTable = checkRepository.findByStatus(TableCheck.OPEN).stream()
                .collect(Collectors.toMap(TableCheck::getTableId, c -> c, (a, b) -> a));
        Map<Long, List<CheckItem>> itemsByCheck = openByTable.isEmpty() ? Map.of()
                : itemRepository.findByCheckIdIn(openByTable.values().stream().map(TableCheck::getId).toList()).stream()
                        .collect(Collectors.groupingBy(CheckItem::getCheckId));
        Map<Long, Long> pendingByCheck = openByTable.isEmpty() ? Map.of()
                : approvalRepository.findByCheckIdInAndStatus(openByTable.values().stream().map(TableCheck::getId).toList(),
                        ApprovalRequest.PENDING).stream()
                        .collect(Collectors.groupingBy(ApprovalRequest::getCheckId, Collectors.counting()));
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (DiningTable t : tables) {
            Map<String, Object> row = tableRow(t);
            TableCheck c = openByTable.get(t.getId());
            if (!Boolean.TRUE.equals(t.getActive())) {
                row.put("status", "INACTIVE");
            } else if (c == null) {
                row.put("status", "FREE");
            } else {
                List<CheckItem> items = itemsByCheck.getOrDefault(c.getId(), List.of()).stream().filter(CheckItem::isActive).toList();
                Map<String, Object> check = new LinkedHashMap<>();
                check.put("id", c.getId());
                check.put("checkNo", c.getCheckNo());
                check.put("guestCount", c.getGuestCount());
                check.put("openedAt", c.getOpenedAt());
                check.put("openedBy", c.getOpenedBy());
                check.put("minutesOpen", c.getOpenedAt() != null ? Duration.between(c.getOpenedAt(), now).toMinutes() : 0);
                BigDecimal sub = total(items);
                check.put("total", sub.subtract(discountFor(c, sub)));
                check.put("hasDiscount", c.hasDiscount());
                check.put("pendingApprovals", pendingByCheck.getOrDefault(c.getId(), 0L));
                check.put("itemCount", items.stream().mapToInt(CheckItem::getQuantity).sum());
                check.put("pendingKitchen", items.stream().filter(i -> CheckItem.ORDERED.equals(i.getStatus()) || CheckItem.PREPARING.equals(i.getStatus())).count());
                check.put("readyCount", items.stream().filter(i -> CheckItem.READY.equals(i.getStatus())).count());
                row.put("status", "OCCUPIED");
                row.put("check", check);
            }
            out.add(row);
        }
        return out;
    }

    public DiningTable createTable(Integer number, String area, Integer capacity) {
        requireTableManager();
        if (number == null || number < 1 || number > 999) throw new IllegalArgumentException("Masa numarasi 1-999 arasinda olmalidir");
        if (tableRepository.existsByNumber(number)) throw new BusinessRuleException("Masa " + number + " zaten tanimli");
        DiningTable t = new DiningTable(number, cleanArea(area), validCapacity(capacity));
        t.setCreatedBy(currentUserService.displayName());
        DiningTable saved = tableRepository.save(t);
        auditService.log("TABLE_CREATED", "TABLE", saved.getId(), null, "ACTIVE",
                saved.label() + " | " + saved.getArea() + " | " + saved.getCapacity() + " kisilik");
        publishTables("TABLE", saved.getNumber());
        return saved;
    }

    public DiningTable updateTable(Long id, String area, Integer capacity, Boolean active) {
        requireTableManager();
        DiningTable t = tableRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Masa bulunamadi: " + id));
        if (Boolean.FALSE.equals(active) && checkRepository.findFirstByTableIdAndStatus(id, TableCheck.OPEN).isPresent()) {
            throw new BusinessRuleException(t.label() + " uzerinde acik adisyon var; once hesabi kapatin.");
        }
        if (area != null) t.setArea(cleanArea(area));
        if (capacity != null) t.setCapacity(validCapacity(capacity));
        if (active != null) t.setActive(active);
        DiningTable saved = tableRepository.save(t);
        auditService.log("TABLE_UPDATED", "TABLE", id, null, Boolean.TRUE.equals(saved.getActive()) ? "ACTIVE" : "INACTIVE",
                saved.label() + " | " + saved.getArea() + " | " + saved.getCapacity() + " kisilik");
        publishTables("TABLE", saved.getNumber());
        return saved;
    }

    // ── Menu (maliyet bilgisi icermez) ─────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> menu() {
        List<InventoryItem> items = inventoryRepository.findAll();
        Map<Long, BigDecimal> reserved = reservedNeeds(items, null);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Recipe r : recipeRepository.findAll()) {
            if (r.getSalePrice() == null || r.getSalePrice().signum() <= 0) continue;
            // Fiyati Mudur tarafindan onaylanmamis yeni receteler satisa acik degildir
            if (!Boolean.TRUE.equals(r.getPriceApproved())) continue;
            List<RecipeService.ResolvedIngredient> ings = recipeService.resolve(r, items, false);
            boolean matched = !ings.isEmpty() && ings.stream().allMatch(i -> i.item() != null);
            int portions = matched ? availablePortions(ings, reserved) : 0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("name", r.getName());
            m.put("category", r.getCategory());
            m.put("salePrice", r.getSalePrice());
            m.put("vatRate", recipeService.effectiveVatRate(r));
            m.put("description", r.getDescription());
            m.put("available", portions > 0);
            m.put("availablePortions", Math.min(portions, 999));
            m.put("unavailableReason", !matched ? "Recete malzemeleri stok kartlariyla eslesmiyor" : portions <= 0 ? "Stok yetersiz" : null);
            out.add(m);
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("category")))
                .thenComparing(m -> String.valueOf(m.get("name"))));
        return out;
    }

    // ── Adisyon ────────────────────────────────────────────────

    public Map<String, Object> openCheck(Long tableId, Integer guests) {
        AuthenticatedUser actor = requirePos();
        DiningTable t = tableRepository.findById(tableId).orElseThrow(() -> new ResourceNotFoundException("Masa bulunamadi: " + tableId));
        if (!Boolean.TRUE.equals(t.getActive())) throw new BusinessRuleException(t.label() + " kullanima kapali");
        TableCheck existing = checkRepository.findFirstByTableIdAndStatus(tableId, TableCheck.OPEN).orElse(null);
        if (existing != null) return checkDetail(existing.getId());
        int guestCount = guests == null ? 1 : guests;
        if (guestCount < 1 || guestCount > 50) throw new IllegalArgumentException("Kisi sayisi 1-50 arasinda olmalidir");
        TableCheck c = new TableCheck();
        c.setCheckNo(nextCheckNo(LocalDate.now()));
        c.setTableId(t.getId());
        c.setTableNumber(t.getNumber());
        c.setGuestCount(guestCount);
        c.setOpenedBy(actor.displayName());
        c.setOpenedAt(LocalDateTime.now());
        TableCheck saved = checkRepository.save(c);
        auditService.log("CHECK_OPENED", "CHECK", saved.getId(), null, TableCheck.OPEN, saved.getCheckNo() + " | " + t.label() + " | " + guestCount + " kisi");
        publishTables("OPENED", t.getNumber());
        return checkDetail(saved.getId());
    }

    public Map<String, Object> addItems(Long checkId, List<ItemInput> inputs) {
        AuthenticatedUser actor = requirePos();
        TableCheck c = lockOpen(checkId);
        if (inputs == null || inputs.isEmpty()) throw new IllegalArgumentException("En az bir kalem secin");
        if (inputs.size() > 30) throw new IllegalArgumentException("Tek seferde en fazla 30 kalem eklenebilir");

        List<InventoryItem> stock = inventoryRepository.findAll();
        Map<Long, BigDecimal> needs = reservedNeeds(stock, null);
        List<CheckItem> created = new ArrayList<>();
        Map<Long, Recipe> recipes = new HashMap<>();
        for (ItemInput in : inputs) {
            if (in == null || in.recipeId() == null) throw new IllegalArgumentException("Menu kalemi secilmedi");
            int qty = in.quantity() == null ? 1 : in.quantity();
            if (qty < 1 || qty > 50) throw new IllegalArgumentException("Adet 1-50 arasinda olmalidir");
            Recipe r = recipes.computeIfAbsent(in.recipeId(), id -> recipeRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Menu kalemi bulunamadi: " + id)));
            if (r.getSalePrice() == null || r.getSalePrice().signum() <= 0) {
                throw new BusinessRuleException(r.getName() + " icin satis fiyati tanimli degil");
            }
            // Esnemeyen eslestirme: odeme aninda hata cikmamasi icin simdiden dogrulanir
            for (RecipeService.ResolvedIngredient ri : recipeService.resolve(r, stock, true)) {
                needs.merge(ri.item().getId(), ri.perPortion().multiply(BigDecimal.valueOf(qty)), BigDecimal::add);
            }
            String note = in.note() == null || in.note().isBlank() ? null : in.note().trim();
            if (note != null && note.length() > 200) throw new IllegalArgumentException("Kalem notu en fazla 200 karakter olabilir");
            CheckItem item = new CheckItem();
            item.setCheckId(c.getId());
            item.setTableNumber(c.getTableNumber());
            item.setRecipeId(r.getId());
            item.setProductName(r.getName());
            item.setCategory(r.getCategory());
            item.setQuantity(qty);
            item.setUnitPrice(r.getSalePrice().setScale(2, RoundingMode.HALF_UP));
            item.setLineTotal(r.getSalePrice().multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP));
            item.setNote(note);
            item.setStatus(CheckItem.ORDERED);
            item.setAddedBy(actor.displayName());
            item.setAddedAt(LocalDateTime.now());
            created.add(item);
        }
        // Acik adisyonlarin ayirdigi miktarlar dahil stok yeterliligi
        Map<Long, InventoryItem> byId = stock.stream().collect(Collectors.toMap(InventoryItem::getId, i -> i));
        List<String> shortages = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : needs.entrySet()) {
            InventoryItem inv = byId.get(e.getKey());
            BigDecimal have = inv == null || inv.getCurrentStock() == null ? BigDecimal.ZERO : inv.getCurrentStock();
            if (inv != null && have.compareTo(e.getValue()) < 0) {
                shortages.add(String.format(Locale.ROOT, "%s (stok %s %s, acik adisyonlarla gereken %s)", inv.getName(),
                        have.stripTrailingZeros().toPlainString(), inv.getUnit(),
                        e.getValue().setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()));
            }
        }
        if (!shortages.isEmpty()) {
            throw new BusinessRuleException("Yetersiz stok: " + String.join("; ", shortages));
        }
        itemRepository.saveAll(created);
        if (printService != null) {
            printService.kitchenTickets(c.getCheckNo(), c.getTableNumber(), actor.displayName(), created.stream()
                    .map(i -> new com.gastrosync.service.print.PrintService.TicketLine(i.getProductName(), i.getQuantity(), i.getNote(),
                            isBeverage(i.getCategory())))
                    .toList());
        }
        String summary = created.stream().map(i -> i.getProductName() + " x" + i.getQuantity()).collect(Collectors.joining(", "));
        auditService.log("CHECK_ITEMS_ADDED", "CHECK", c.getId(), null, TableCheck.OPEN, c.getCheckNo() + " | Masa " + c.getTableNumber() + " | " + summary);
        Map<String, Object> kitchen = new LinkedHashMap<>();
        kitchen.put("type", "ORDER");
        kitchen.put("tableNumber", c.getTableNumber());
        kitchen.put("checkId", c.getId());
        kitchen.put("summary", summary);
        notificationService.publish("/topic/kitchen", kitchen);
        publishTables("ITEMS", c.getTableNumber());
        return checkDetail(c.getId());
    }

    public Map<String, Object> updateItemStatus(Long itemId, String rawStatus) {
        AuthenticatedUser actor = currentUserService.require();
        String status = rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT);
        CheckItem item = itemRepository.findById(itemId).orElseThrow(() -> new ResourceNotFoundException("Adisyon kalemi bulunamadi: " + itemId));
        TableCheck c = lockOpen(item.getCheckId());
        if (!item.isActive()) throw new BusinessRuleException("Iptal edilmis kalemin durumu degistirilemez");
        boolean kitchenRole = currentUserService.can(Permissions.P.KITCHEN_OPERATE);
        boolean posRole = currentUserService.can(Permissions.P.POS_OPERATE);
        switch (status) {
            case CheckItem.PREPARING, CheckItem.READY -> {
                if (!kitchenRole) throw new AccessDeniedException("Hazirlanma durumunu yalnizca Mutfak Sefi guncelleyebilir");
                if (CheckItem.SERVED.equals(item.getStatus())) throw new BusinessRuleException("Servis edilmis kalem geri alinamaz");
                if (CheckItem.PREPARING.equals(status) && !CheckItem.ORDERED.equals(item.getStatus())) {
                    throw new BusinessRuleException("Yalnizca yeni siparis hazirlanmaya alinabilir");
                }
            }
            case CheckItem.SERVED -> {
                if (!posRole && !kitchenRole) throw new AccessDeniedException("Servis bilgisini Kasa / Mutfak girebilir");
            }
            default -> throw new IllegalArgumentException("Gecersiz durum: " + rawStatus + " (PREPARING, READY, SERVED)");
        }
        String old = item.getStatus();
        item.setStatus(status);
        item.setStatusChangedAt(LocalDateTime.now());
        item.setStatusChangedBy(actor.displayName());
        itemRepository.save(item);
        Map<String, Object> evt = new LinkedHashMap<>();
        evt.put("type", status);
        evt.put("tableNumber", c.getTableNumber());
        evt.put("checkId", c.getId());
        evt.put("product", item.getProductName());
        evt.put("quantity", item.getQuantity());
        evt.put("previous", old);
        notificationService.publish("/topic/kitchen", evt);
        notificationService.publish("/topic/tables", evt);
        return checkDetail(c.getId());
    }

    public Map<String, Object> cancelItem(Long itemId, String reason) {
        AuthenticatedUser actor = requirePosOrApprover();
        String why = requireReason(reason);
        CheckItem item = itemRepository.findById(itemId).orElseThrow(() -> new ResourceNotFoundException("Adisyon kalemi bulunamadi: " + itemId));
        TableCheck c = lockOpen(item.getCheckId());
        if (!item.isActive()) throw new BusinessRuleException("Kalem zaten iptal edilmis");
        boolean started = !CheckItem.ORDERED.equals(item.getStatus());
        if (started && !currentUserService.can(Permissions.P.POS_CANCEL_APPROVE)) {
            throw new AccessDeniedException("Hazirlanmaya baslanmis veya servis edilmis kalemi yalnizca Isletme Muduru iptal edebilir; "
                    + "'Iptal talebi' ile Mudur onayina gonderin");
        }
        applyItemCancel(c, item, why, actor.displayName(), null);
        return checkDetail(c.getId());
    }

    /** Kalem iptalini uygular. approvedBy doluysa iptal, talebi onaylayan Mudurun imzasiyla yapilir. */
    public void applyItemCancel(TableCheck c, CheckItem item, String why, String requestedBy, String approvedBy) {
        boolean started = !CheckItem.ORDERED.equals(item.getStatus());
        String old = item.getStatus();
        item.setStatus(CheckItem.CANCELLED);
        item.setCancelReason(why);
        item.setStatusChangedAt(LocalDateTime.now());
        item.setStatusChangedBy(approvedBy != null ? approvedBy : requestedBy);
        itemRepository.save(item);
        expirePending(approvalRepository.findByTargetTypeAndTargetIdAndStatus("CHECK_ITEM", item.getId(), ApprovalRequest.PENDING),
                "Kalem iptal edildi");
        auditService.log("CHECK_ITEM_CANCELLED", "CHECK", c.getId(), old, CheckItem.CANCELLED,
                c.getCheckNo() + " | Masa " + c.getTableNumber() + " | " + item.getProductName() + " x" + item.getQuantity() + " | " + why
                        + (approvedBy != null ? " | Talep: " + requestedBy + " | Onay: " + approvedBy : ""));
        if (started && approvedBy == null) {
            notificationService.notify(List.of(AppRoles.MANAGER),
                    "Hazirlanan Kalem Iptal Edildi: Masa " + c.getTableNumber(),
                    String.format("%s, Masa %d adisyonundaki %s x%d kalemini (%s asamasinda) iptal etti. Gerekce: %s. Fire kaydi gerekebilir.",
                            requestedBy, c.getTableNumber(), item.getProductName(), item.getQuantity(), old, why),
                    requestedBy, "CHECK_ITEM_CANCELLED", c.getId(), "/pos", "WARNING");
        }
        Map<String, Object> evt = new LinkedHashMap<>();
        evt.put("type", "CANCELLED");
        evt.put("tableNumber", c.getTableNumber());
        evt.put("product", item.getProductName());
        notificationService.publish("/topic/kitchen", evt);
        publishTables("ITEMS", c.getTableNumber());
    }

    // ── Ikram ve indirim (Mudur dogrudan; Kasiyer onay talebiyle) ─────────

    public Map<String, Object> compItem(Long itemId, String reason) {
        AuthenticatedUser actor = currentUserService.require();
        if (!currentUserService.can(Permissions.P.POS_DISCOUNT_APPROVE)) {
            throw new AccessDeniedException("Ikram Isletme Muduru onayiyla yapilir; 'Ikram talebi' ile Mudure gonderin");
        }
        String why = requireReason(reason);
        CheckItem item = itemRepository.findById(itemId).orElseThrow(() -> new ResourceNotFoundException("Adisyon kalemi bulunamadi: " + itemId));
        TableCheck c = lockOpen(item.getCheckId());
        validateCompTarget(item);
        applyComp(c, item, why, actor.displayName(), actor.displayName());
        return checkDetail(c.getId());
    }

    public static void validateCompTarget(CheckItem item) {
        if (!item.isActive()) throw new BusinessRuleException("Iptal edilmis kalem ikram edilemez");
        if (item.isComp()) throw new BusinessRuleException("Kalem zaten ikram olarak isaretli");
    }

    public void applyComp(TableCheck c, CheckItem item, String why, String requestedBy, String approvedBy) {
        BigDecimal value = item.getListTotal();
        item.setComp(Boolean.TRUE);
        item.setCompReason(why);
        item.setCompBy(approvedBy);
        item.setLineTotal(BigDecimal.ZERO.setScale(2));
        itemRepository.save(item);
        expirePending(approvalRepository.findByTargetTypeAndTargetIdAndStatus("CHECK_ITEM", item.getId(), ApprovalRequest.PENDING)
                .stream().filter(a -> ApprovalRequest.COMP.equals(a.getType())).toList(), "Kalem ikram edildi");
        auditService.log("CHECK_ITEM_COMP", "CHECK", c.getId(), null, "COMP",
                String.format("%s | Masa %d | %s x%d ikram (%s TL) | %s | Talep: %s | Onay: %s", c.getCheckNo(), c.getTableNumber(),
                        item.getProductName(), item.getQuantity(), value.toPlainString(), why, requestedBy, approvedBy));
        publishTables("COMP", c.getTableNumber());
    }

    public Map<String, Object> setDiscount(Long checkId, BigDecimal percent, BigDecimal amount, String reason) {
        AuthenticatedUser actor = currentUserService.require();
        if (!currentUserService.can(Permissions.P.POS_DISCOUNT_APPROVE)) {
            throw new AccessDeniedException("Indirim Isletme Muduru onayiyla yapilir; 'Indirim talebi' ile Mudure gonderin");
        }
        String why = requireReason(reason);
        TableCheck c = lockOpen(checkId);
        validateDiscount(percent, amount, payableSubtotal(c));
        applyDiscount(c, percent, amount, why, actor.displayName(), actor.displayName());
        return checkDetail(c.getId());
    }

    public Map<String, Object> removeDiscount(Long checkId) {
        currentUserService.require();
        if (!currentUserService.can(Permissions.P.POS_DISCOUNT_APPROVE)) {
            throw new AccessDeniedException("Indirimi yalnizca Isletme Muduru kaldirabilir");
        }
        TableCheck c = lockOpen(checkId);
        if (!c.hasDiscount()) throw new BusinessRuleException("Adisyonda indirim yok");
        c.setDiscountPercent(null);
        c.setDiscountValue(null);
        c.setDiscountReason(null);
        c.setDiscountBy(null);
        checkRepository.save(c);
        auditService.log("CHECK_DISCOUNT_REMOVED", "CHECK", c.getId(), "DISCOUNT", null, c.getCheckNo() + " | Masa " + c.getTableNumber());
        publishTables("DISCOUNT", c.getTableNumber());
        return checkDetail(c.getId());
    }

    /** Yuzde (1-100) VEYA tutar; tutar, ikram disi kalemlerin toplamini asamaz */
    public static void validateDiscount(BigDecimal percent, BigDecimal amount, BigDecimal subtotal) {
        boolean hasPercent = percent != null && percent.signum() > 0;
        boolean hasAmount = amount != null && amount.signum() > 0;
        if (hasPercent == hasAmount) throw new IllegalArgumentException("Indirim icin yuzde VEYA tutar girin");
        if (subtotal == null || subtotal.signum() <= 0) throw new BusinessRuleException("Adisyonda ucretli kalem yok; indirim uygulanamaz");
        if (hasPercent && percent.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException("Indirim yuzdesi 1-100 arasinda olmalidir");
        }
        if (hasAmount && amount.compareTo(subtotal) > 0) {
            throw new BusinessRuleException("Indirim tutari (" + ExpenseService.fmt(amount) + " TL) adisyon tutarini ("
                    + ExpenseService.fmt(subtotal) + " TL) asamaz");
        }
    }

    public void applyDiscount(TableCheck c, BigDecimal percent, BigDecimal amount, String why, String requestedBy, String approvedBy) {
        boolean hasPercent = percent != null && percent.signum() > 0;
        c.setDiscountPercent(hasPercent ? percent.setScale(2, RoundingMode.HALF_UP) : null);
        c.setDiscountValue(hasPercent ? null : amount.setScale(2, RoundingMode.HALF_UP));
        c.setDiscountReason(why);
        c.setDiscountBy(approvedBy);
        checkRepository.save(c);
        auditService.log("CHECK_DISCOUNT", "CHECK", c.getId(), null, "DISCOUNT",
                String.format("%s | Masa %d | %s | %s | Talep: %s | Onay: %s", c.getCheckNo(), c.getTableNumber(),
                        hasPercent ? "%" + c.getDiscountPercent().stripTrailingZeros().toPlainString() : ExpenseService.fmt(c.getDiscountValue()) + " TL",
                        why, requestedBy, approvedBy));
        publishTables("DISCOUNT", c.getTableNumber());
    }

    /** Acik adisyonun ikram disi aktif kalemlerinin toplami */
    public BigDecimal payableSubtotal(TableCheck c) {
        return total(itemRepository.findByCheckIdOrderByIdAsc(c.getId()));
    }

    /** Onayli indirimin bu ara toplama gore tutari */
    public static BigDecimal discountFor(TableCheck c, BigDecimal subtotal) {
        if (subtotal == null || subtotal.signum() <= 0) return BigDecimal.ZERO.setScale(2);
        if (c.getDiscountPercent() != null && c.getDiscountPercent().signum() > 0) {
            return subtotal.multiply(c.getDiscountPercent()).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP).min(subtotal);
        }
        if (c.getDiscountValue() != null && c.getDiscountValue().signum() > 0) {
            return c.getDiscountValue().setScale(2, RoundingMode.HALF_UP).min(subtotal);
        }
        return BigDecimal.ZERO.setScale(2);
    }

    /** Onay akisi (ApprovalService) icin yardimcilar */
    public TableCheck lockOpenCheck(Long checkId) {
        return lockOpen(checkId);
    }

    public CheckItem findItem(Long itemId) {
        return itemRepository.findById(itemId).orElseThrow(() -> new ResourceNotFoundException("Adisyon kalemi bulunamadi: " + itemId));
    }

    public TableCheck findCheck(Long checkId) {
        return checkRepository.findById(checkId).orElseThrow(() -> new ResourceNotFoundException("Adisyon bulunamadi: " + checkId));
    }

    public List<CheckItem> activeItems(Long checkId) {
        return itemRepository.findByCheckIdOrderByIdAsc(checkId).stream().filter(CheckItem::isActive).toList();
    }

    private void expirePending(List<ApprovalRequest> pending, String note) {
        if (pending == null || pending.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        for (ApprovalRequest a : pending) {
            a.setStatus(ApprovalRequest.EXPIRED);
            a.setDecidedAt(now);
            a.setDecisionNote(note);
        }
        approvalRepository.saveAll(pending);
        notificationService.publish("/topic/approvals", Map.of("type", "EXPIRED"));
    }

    public Map<String, Object> transfer(Long checkId, Long targetTableId) {
        requirePos();
        TableCheck c = lockOpen(checkId);
        DiningTable target = tableRepository.findById(targetTableId).orElseThrow(() -> new ResourceNotFoundException("Masa bulunamadi: " + targetTableId));
        if (!Boolean.TRUE.equals(target.getActive())) throw new BusinessRuleException(target.label() + " kullanima kapali");
        if (target.getId().equals(c.getTableId())) throw new BusinessRuleException("Adisyon zaten bu masada");
        if (checkRepository.findFirstByTableIdAndStatus(target.getId(), TableCheck.OPEN).isPresent()) {
            throw new BusinessRuleException(target.label() + " dolu; once o masanin hesabini kapatin");
        }
        int from = c.getTableNumber();
        c.setTableId(target.getId());
        c.setTableNumber(target.getNumber());
        checkRepository.save(c);
        List<CheckItem> items = itemRepository.findByCheckIdOrderByIdAsc(c.getId());
        items.forEach(i -> i.setTableNumber(target.getNumber()));
        itemRepository.saveAll(items);
        auditService.log("CHECK_TRANSFERRED", "CHECK", c.getId(), "Masa " + from, target.label(), c.getCheckNo());
        publishTables("TRANSFER", target.getNumber());
        return checkDetail(c.getId());
    }

    /** Tahsilat: kalemler satis kaydina doner, stok duser, gelir ve KDV olusur; adisyon kapanir */
    /** Tek yontemle kalan tutarin tamamini tahsil eder ve adisyonu kapatir (eski davranis). */
    public Map<String, Object> pay(Long checkId, String paymentMethod, BigDecimal received) {
        return addPayment(checkId, paymentMethod, null, null, received, null);
    }

    /**
     * Parcali odeme / hesap bolme. amount bos ve itemIds bos ise kalan tutarin tamami odenir.
     * itemIds verilirse tutar o kalemlerden (indirim oraninda) hesaplanir. Kalan tutar sifirlaninca adisyon kapanir.
     */
    public Map<String, Object> addPayment(Long checkId, String paymentMethod, BigDecimal amount, List<Long> itemIds,
                                          BigDecimal received, String label) {
        AuthenticatedUser actor = requirePos();
        TableCheck c = lockOpen(checkId);
        List<CheckItem> items = activeItems(c.getId());
        if (items.isEmpty()) throw new BusinessRuleException("Adisyonda odenecek kalem yok; bos adisyonu iptal edin.");
        if (!approvalRepository.findByCheckIdAndStatus(c.getId(), ApprovalRequest.PENDING).isEmpty()) {
            throw new BusinessRuleException("Bu adisyonda Isletme Muduru kararini bekleyen onay talebi var. "
                    + "Karar verilmesini bekleyin veya talebi geri cekin.");
        }
        String method = SalesService.normalizePaymentMethod(paymentMethod);
        BigDecimal subtotal = total(items);
        BigDecimal payable = subtotal.subtract(discountFor(c, subtotal)).setScale(2, RoundingMode.HALF_UP);
        List<CheckPayment> payments = new ArrayList<>(paymentRepository.findByCheckIdAndVoidedFalseOrderByPaidAtAscIdAsc(c.getId()));
        BigDecimal paid = payments.stream().map(CheckPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = payable.subtract(paid);
        if (remaining.signum() < 0) {
            throw new BusinessRuleException("Alinan tahsilat (" + ExpenseService.fmt(paid) + " TL) hesap tutarini ("
                    + ExpenseService.fmt(payable) + " TL) asiyor. Fazla tahsilati geri alin.");
        }
        String paidItemIds = null;
        BigDecimal amt;
        if (itemIds != null && !itemIds.isEmpty()) {
            java.util.Set<Long> already = paidItemIdSet(payments);
            java.util.Set<Long> wanted = new java.util.LinkedHashSet<>(itemIds);
            BigDecimal itemsTotal = BigDecimal.ZERO;
            for (Long id : wanted) {
                CheckItem it = items.stream().filter(i -> i.getId().equals(id)).findFirst()
                        .orElseThrow(() -> new BusinessRuleException("Kalem bu adisyonda degil veya iptal edilmis: " + id));
                if (already.contains(id)) throw new BusinessRuleException(it.getProductName() + " zaten odendi");
                itemsTotal = itemsTotal.add(it.getLineTotal() == null ? BigDecimal.ZERO : it.getLineTotal());
            }
            BigDecimal ratio = subtotal.signum() > 0 ? payable.divide(subtotal, 8, RoundingMode.HALF_UP) : BigDecimal.ONE;
            amt = itemsTotal.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
            paidItemIds = wanted.stream().map(String::valueOf).collect(Collectors.joining(","));
        } else {
            amt = amount == null ? remaining : amount.setScale(2, RoundingMode.HALF_UP);
        }
        if (amt.signum() <= 0) throw new BusinessRuleException("Tahsil edilecek tutar sifirdan buyuk olmalidir");
        // Kurus farklari son odemede kapanir
        if (amt.compareTo(remaining) > 0) {
            if (amt.subtract(remaining).compareTo(new BigDecimal("0.05")) > 0) {
                throw new BusinessRuleException("Tahsilat (" + ExpenseService.fmt(amt) + " TL) kalan tutardan ("
                        + ExpenseService.fmt(remaining) + " TL) fazla");
            }
            amt = remaining;
        }
        BigDecimal change = null;
        BigDecimal r = received == null ? null : received.setScale(2, RoundingMode.HALF_UP);
        if (r != null && SalesService.CASH.equals(method)) {
            if (r.compareTo(amt) < 0) throw new BusinessRuleException("Alinan nakit (" + ExpenseService.fmt(r) + " TL) tahsil edilecek tutardan az");
            change = r.subtract(amt);
        }
        String cleanLabel = label == null || label.isBlank() ? null : label.trim();
        if (cleanLabel != null && cleanLabel.length() > 120) throw new IllegalArgumentException("Odeme etiketi en fazla 120 karakter olabilir");

        CheckPayment pmt = new CheckPayment();
        pmt.setCheckId(c.getId());
        pmt.setCheckNo(c.getCheckNo());
        pmt.setMethod(method);
        pmt.setAmount(amt);
        pmt.setReceivedAmount(SalesService.CASH.equals(method) ? r : null);
        pmt.setChangeAmount(change);
        pmt.setItemIds(paidItemIds);
        pmt.setLabel(cleanLabel);
        pmt.setPaidBy(actor.displayName());
        pmt.setPaidAt(LocalDateTime.now());
        paymentRepository.save(pmt);
        payments.add(pmt);
        BigDecimal newRemaining = remaining.subtract(amt);
        auditService.log("CHECK_PAYMENT", "CHECK", c.getId(), null, method,
                String.format("%s | Masa %d | %s TL %s | kalan %s TL%s", c.getCheckNo(), c.getTableNumber(), amt.toPlainString(),
                        method, newRemaining.toPlainString(), cleanLabel != null ? " | " + cleanLabel : ""));

        if (newRemaining.signum() > 0) {
            publishTables("PARTIAL_PAYMENT", c.getTableNumber());
            Map<String, Object> detail = checkDetail(c.getId());
            Map<String, Object> last = new LinkedHashMap<>();
            last.put("id", pmt.getId());
            last.put("method", method);
            last.put("amount", amt);
            last.put("change", change);
            detail.put("lastPayment", last);
            detail.put("closed", false);
            return detail;
        }
        String salesMethod = payments.stream().map(CheckPayment::getMethod).distinct().count() == 1 ? method : SalesService.MIXED;
        Map<String, Object> receipt = closePaidCheck(c, items, salesMethod, actor, payments, change);
        receipt.put("closed", true);
        return receipt;
    }

    /** Odemesi tamamlanan adisyonu kapatir: satis kaydi + stok dusumu + fis (atomik). */
    private Map<String, Object> closePaidCheck(TableCheck c, List<CheckItem> items, String method, AuthenticatedUser actor,
                                               List<CheckPayment> payments, BigDecimal lastChange) {

        // Ayni urunun ucretli ve ikram kalemleri ayri satis satirlarina ayrilir
        Map<String, Integer> qtyByLine = new LinkedHashMap<>();
        Map<String, Long> recipeByLine = new HashMap<>();
        for (CheckItem i : items) {
            String key = i.getRecipeId() + (i.isComp() ? "|C" : "|P");
            qtyByLine.merge(key, i.getQuantity(), Integer::sum);
            recipeByLine.put(key, i.getRecipeId());
        }
        List<SalesService.OrderLine> lines = new ArrayList<>();
        List<Boolean> compFlags = new ArrayList<>();
        qtyByLine.forEach((k, q) -> {
            lines.add(new SalesService.OrderLine(recipeByLine.get(k), null, q));
            compFlags.add(k.endsWith("|C"));
        });
        BigDecimal subtotal = total(items);
        BigDecimal discount = discountFor(c, subtotal);
        BigDecimal compValue = items.stream().filter(CheckItem::isComp).map(CheckItem::getListTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<SalesRecord> sales = salesService.recordCheckOrder("Masa " + c.getTableNumber(), method, c.getCheckNo(),
                lines, compFlags, discount);

        BigDecimal total = sales.stream().map(SalesRecord::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal vat = sales.stream().map(s -> s.getVatAmount() == null ? BigDecimal.ZERO : s.getVatAmount()).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal change = lastChange;
        BigDecimal cashReceived = payments.stream().map(CheckPayment::getReceivedAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (cashReceived.signum() > 0) c.setReceivedAmount(cashReceived);
        LocalDateTime now = LocalDateTime.now();
        for (CheckItem i : items) {
            if (!CheckItem.SERVED.equals(i.getStatus())) {
                i.setStatus(CheckItem.SERVED);
                i.setStatusChangedAt(now);
                i.setStatusChangedBy(actor.displayName());
            }
        }
        itemRepository.saveAll(items);
        c.setStatus(TableCheck.PAID);
        c.setPaymentMethod(method);
        c.setTotalAmount(total);
        c.setVatAmount(vat);
        c.setDiscountAmount(discount.signum() > 0 ? discount : null);
        c.setCompAmount(compValue.signum() > 0 ? compValue : null);
        c.setClosedBy(actor.displayName());
        c.setClosedAt(now);
        checkRepository.save(c);
        auditService.log("CHECK_PAID", "CHECK", c.getId(), TableCheck.OPEN, TableCheck.PAID,
                String.format("%s | Masa %d | %s TL | %s%s%s", c.getCheckNo(), c.getTableNumber(), total.toPlainString(), method,
                        discount.signum() > 0 ? " | indirim " + discount.toPlainString() + " TL" : "",
                        compValue.signum() > 0 ? " | ikram " + compValue.toPlainString() + " TL" : ""));
        publishTables("PAID", c.getTableNumber());

        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("checkId", c.getId());
        receipt.put("checkNo", c.getCheckNo());
        receipt.put("tableNumber", c.getTableNumber());
        receipt.put("guestCount", c.getGuestCount());
        receipt.put("paymentMethod", method);
        receipt.put("lines", sales.stream().map(s -> {
            Map<String, Object> l = new LinkedHashMap<>();
            l.put("productName", s.getProductName());
            l.put("quantity", s.getQuantity());
            l.put("unitPrice", s.getUnitPrice());
            l.put("total", s.getTotalPrice());
            l.put("vatRate", s.getVatRate());
            l.put("comp", Boolean.TRUE.equals(s.getComp()));
            l.put("discount", s.getDiscountAmount());
            return l;
        }).toList());
        receipt.put("subtotal", subtotal);
        receipt.put("discountAmount", discount);
        receipt.put("discountReason", c.getDiscountReason());
        receipt.put("compAmount", compValue);
        receipt.put("total", total);
        receipt.put("vatAmount", vat);
        receipt.put("netAmount", total.subtract(vat));
        receipt.put("receivedAmount", c.getReceivedAmount());
        receipt.put("change", change);
        receipt.put("payments", payments.stream().map(PosService::paymentRow).toList());
        receipt.put("cashier", actor.displayName());
        receipt.put("closedAt", now);
        receipt.put("openedAt", c.getOpenedAt());
        return receipt;
    }

    public Map<String, Object> cancelCheck(Long checkId, String reason) {
        AuthenticatedUser actor = requirePosOrApprover();
        String why = requireReason(reason);
        TableCheck c = lockOpen(checkId);
        if (!paymentRepository.findByCheckIdAndVoidedFalseOrderByPaidAtAscIdAsc(c.getId()).isEmpty()) {
            throw new BusinessRuleException("Bu adisyonda alinmis tahsilat var. Iptalden once tahsilatlari gerekceyle geri alin.");
        }
        boolean started = activeItems(c.getId()).stream().anyMatch(i -> !CheckItem.ORDERED.equals(i.getStatus()));
        if (started && !currentUserService.can(Permissions.P.POS_CANCEL_APPROVE)) {
            throw new AccessDeniedException("Hazirlanmis kalem iceren adisyonu yalnizca Isletme Muduru iptal edebilir; "
                    + "'Iptal talebi' ile Mudur onayina gonderin");
        }
        applyCheckCancel(c, why, actor.displayName(), null);
        return checkDetail(c.getId());
    }

    /** Adisyon iptalini uygular. approvedBy doluysa talebi onaylayan Mudurun imzasiyla yapilir. */
    public void applyCheckCancel(TableCheck c, String why, String requestedBy, String approvedBy) {
        List<CheckItem> active = activeItems(c.getId());
        String actorName = approvedBy != null ? approvedBy : requestedBy;
        LocalDateTime now = LocalDateTime.now();
        for (CheckItem i : active) {
            i.setStatus(CheckItem.CANCELLED);
            i.setCancelReason(why);
            i.setStatusChangedAt(now);
            i.setStatusChangedBy(actorName);
        }
        itemRepository.saveAll(active);
        c.setStatus(TableCheck.CANCELLED);
        c.setCancelReason(why);
        c.setClosedBy(actorName);
        c.setClosedAt(now);
        c.setTotalAmount(BigDecimal.ZERO);
        checkRepository.save(c);
        expirePending(approvalRepository.findByCheckIdAndStatus(c.getId(), ApprovalRequest.PENDING), "Adisyon iptal edildi");
        auditService.log("CHECK_CANCELLED", "CHECK", c.getId(), TableCheck.OPEN, TableCheck.CANCELLED,
                c.getCheckNo() + " | Masa " + c.getTableNumber() + " | " + active.size() + " kalem | " + why
                        + (approvedBy != null ? " | Talep: " + requestedBy + " | Onay: " + approvedBy : ""));
        if (!active.isEmpty() && approvedBy == null) {
            notificationService.notify(List.of(AppRoles.MANAGER),
                    "Adisyon Iptal Edildi: Masa " + c.getTableNumber(),
                    String.format("%s, %s numarali adisyonu (%d kalem) iptal etti. Gerekce: %s", requestedBy,
                            c.getCheckNo(), active.size(), why),
                    requestedBy, "CHECK_CANCELLED", c.getId(), "/pos", "WARNING");
        }
        publishTables("CANCELLED", c.getTableNumber());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> checkDetail(Long checkId) {
        TableCheck c = checkRepository.findById(checkId).orElseThrow(() -> new ResourceNotFoundException("Adisyon bulunamadi: " + checkId));
        List<CheckItem> items = itemRepository.findByCheckIdOrderByIdAsc(c.getId());
        List<CheckItem> active = items.stream().filter(CheckItem::isActive).toList();
        BigDecimal subtotal = total(active);
        BigDecimal discount = c.isOpen() ? discountFor(c, subtotal) : nz(c.getDiscountAmount());
        BigDecimal total = c.isOpen() ? subtotal.subtract(discount) : c.getTotalAmount();
        BigDecimal compTotal = active.stream().filter(CheckItem::isComp).map(CheckItem::getListTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("checkNo", c.getCheckNo());
        m.put("tableId", c.getTableId());
        m.put("tableNumber", c.getTableNumber());
        m.put("status", c.getStatus());
        m.put("guestCount", c.getGuestCount());
        m.put("openedBy", c.getOpenedBy());
        m.put("openedAt", c.getOpenedAt());
        m.put("closedBy", c.getClosedBy());
        m.put("closedAt", c.getClosedAt());
        m.put("paymentMethod", c.getPaymentMethod());
        m.put("cancelReason", c.getCancelReason());
        m.put("total", total);
        m.put("subtotal", subtotal);
        m.put("discountAmount", discount);
        m.put("discountPercent", c.getDiscountPercent());
        m.put("discountValue", c.getDiscountValue());
        m.put("discountReason", c.getDiscountReason());
        m.put("discountBy", c.getDiscountBy());
        m.put("compTotal", compTotal);
        m.put("pendingApprovals", approvalRepository.findByCheckIdAndStatus(c.getId(), ApprovalRequest.PENDING).stream().map(a -> {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", a.getId());
            x.put("type", a.getType());
            x.put("targetType", a.getTargetType());
            x.put("targetId", a.getTargetId());
            x.put("reason", a.getReason());
            x.put("requestedBy", a.getRequestedBy());
            x.put("requestedByName", a.getRequestedByName());
            x.put("requestedAt", a.getRequestedAt());
            return x;
        }).toList());
        m.put("vatAmount", c.isOpen() ? null : c.getVatAmount());
        m.put("itemCount", active.stream().mapToInt(CheckItem::getQuantity).sum());
        List<CheckPayment> pays = paymentRepository.findByCheckIdOrderByPaidAtAscIdAsc(c.getId());
        List<CheckPayment> livePays = pays.stream().filter(x -> !x.isVoided()).toList();
        BigDecimal paidSum = livePays.stream().map(CheckPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        m.put("payments", pays.stream().map(PosService::paymentRow).toList());
        m.put("paidAmount", paidSum);
        m.put("remainingAmount", c.isOpen() ? total.subtract(paidSum).max(BigDecimal.ZERO) : BigDecimal.ZERO);
        m.put("paidItemIds", paidItemIdSet(livePays));
        m.put("items", items);
        return m;
    }

    // ── Mutfak ekrani ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> kitchenBoard() {
        Map<Long, TableCheck> open = checkRepository.findByStatus(TableCheck.OPEN).stream()
                .collect(Collectors.toMap(TableCheck::getId, c -> c));
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (CheckItem i : itemRepository.findByStatusInOrderByAddedAtAsc(KITCHEN_ACTIVE)) {
            TableCheck c = open.get(i.getCheckId());
            if (c == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("checkId", c.getId());
            m.put("checkNo", c.getCheckNo());
            m.put("tableNumber", c.getTableNumber());
            m.put("productName", i.getProductName());
            m.put("category", i.getCategory());
            m.put("bar", isBeverage(i.getCategory()));
            m.put("quantity", i.getQuantity());
            m.put("note", i.getNote());
            m.put("status", i.getStatus());
            m.put("addedAt", i.getAddedAt());
            m.put("addedBy", i.getAddedBy());
            m.put("waitMinutes", i.getAddedAt() != null ? Duration.between(i.getAddedAt(), now).toMinutes() : 0);
            out.add(m);
        }
        return out;
    }

    // ── Ozet ve gecmis ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> summary(LocalDate rawDate) {
        LocalDate day = rawDate == null ? LocalDate.now() : rawDate;
        LocalDateTime from = day.atStartOfDay();
        LocalDateTime to = day.plusDays(1).atStartOfDay();
        List<TableCheck> open = checkRepository.findByStatus(TableCheck.OPEN);
        Map<Long, List<CheckItem>> openItems = open.isEmpty() ? Map.of()
                : itemRepository.findByCheckIdIn(open.stream().map(TableCheck::getId).toList()).stream()
                        .filter(CheckItem::isActive).collect(Collectors.groupingBy(CheckItem::getCheckId));
        BigDecimal openTotal = openItems.values().stream().map(this::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<TableCheck> paid = checkRepository.findByStatusAndClosedAtBetween(TableCheck.PAID, from, to);
        List<TableCheck> cancelled = checkRepository.findByStatusAndClosedAtBetween(TableCheck.CANCELLED, from, to);
        BigDecimal revenue = paid.stream().map(c -> nz(c.getTotalAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = paid.stream().map(c -> nz(c.getDiscountAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal compTotal = paid.stream().map(c -> nz(c.getCompAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, BigDecimal> byMethod = new LinkedHashMap<>();
        for (String m : List.of(SalesService.CASH, SalesService.CREDIT_CARD, SalesService.MEAL_CARD)) byMethod.put(m, BigDecimal.ZERO);
        for (TableCheck c : paid) byMethod.merge(c.getPaymentMethod(), nz(c.getTotalAmount()), BigDecimal::add);
        int guests = paid.stream().mapToInt(c -> c.getGuestCount() == null ? 0 : c.getGuestCount()).sum();
        long tables = tableRepository.findAll().stream().filter(t -> Boolean.TRUE.equals(t.getActive())).count();

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("date", day);
        r.put("activeTables", tables);
        r.put("openChecks", open.size());
        r.put("openTotal", openTotal);
        r.put("paidChecks", paid.size());
        r.put("cancelledChecks", cancelled.size());
        r.put("revenue", revenue);
        r.put("discountTotal", discountTotal);
        r.put("compTotal", compTotal);
        r.put("averageCheck", paid.isEmpty() ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(paid.size()), 2, RoundingMode.HALF_UP));
        r.put("guests", guests);
        r.put("averagePerGuest", guests == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(guests), 2, RoundingMode.HALF_UP));
        r.put("byPaymentMethod", byMethod);
        r.put("kitchenQueue", kitchenBoard().stream().filter(m -> !CheckItem.READY.equals(m.get("status"))).count());
        r.put("readyToServe", kitchenBoard().stream().filter(m -> CheckItem.READY.equals(m.get("status"))).count());
        return r;
    }

    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> closedChecks(LocalDate rawDate, String rawStatus, Integer page, Integer size) {
        LocalDate day = rawDate == null ? LocalDate.now() : rawDate;
        String status = rawStatus != null && rawStatus.equalsIgnoreCase(TableCheck.CANCELLED) ? TableCheck.CANCELLED : TableCheck.PAID;
        Page<TableCheck> result = checkRepository.findByStatusAndClosedAtBetweenOrderByClosedAtDesc(status,
                day.atStartOfDay(), day.plusDays(1).atStartOfDay(),
                PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size)));
        Map<Long, List<CheckItem>> items = result.isEmpty() ? Map.of()
                : itemRepository.findByCheckIdIn(result.getContent().stream().map(TableCheck::getId).toList()).stream()
                        .collect(Collectors.groupingBy(CheckItem::getCheckId));
        return PageResponse.of(result, c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("checkNo", c.getCheckNo());
            m.put("tableNumber", c.getTableNumber());
            m.put("guestCount", c.getGuestCount());
            m.put("status", c.getStatus());
            m.put("total", c.getTotalAmount());
            m.put("vatAmount", c.getVatAmount());
            m.put("paymentMethod", c.getPaymentMethod());
            m.put("openedAt", c.getOpenedAt());
            m.put("closedAt", c.getClosedAt());
            m.put("closedBy", c.getClosedBy());
            m.put("cancelReason", c.getCancelReason());
            m.put("discountAmount", c.getDiscountAmount());
            m.put("compAmount", c.getCompAmount());
            m.put("items", items.getOrDefault(c.getId(), List.of()).stream().filter(CheckItem::isActive)
                    .map(i -> i.getProductName() + " x" + i.getQuantity()).toList());
            return m;
        }, Map.of("date", day, "status", status));
    }

    // ── Yardimcilar ────────────────────────────────────────────

    /** Acik adisyonlardaki (odenmemis) aktif kalemlerin recete ihtiyaci: stok kalemi -> miktar */
    private Map<Long, BigDecimal> reservedNeeds(List<InventoryItem> stock, Long excludeCheckId) {
        Map<Long, BigDecimal> needs = new HashMap<>();
        List<Long> openIds = checkRepository.findByStatus(TableCheck.OPEN).stream()
                .map(TableCheck::getId).filter(id -> !id.equals(excludeCheckId)).toList();
        if (openIds.isEmpty()) return needs;
        Map<Long, List<RecipeService.ResolvedIngredient>> cache = new HashMap<>();
        for (CheckItem i : itemRepository.findByCheckIdIn(openIds)) {
            if (!i.isActive()) continue;
            List<RecipeService.ResolvedIngredient> ings = cache.computeIfAbsent(i.getRecipeId(), id -> recipeRepository.findById(id)
                    .map(r -> recipeService.resolve(r, stock, false)).orElse(List.of()));
            for (RecipeService.ResolvedIngredient ri : ings) {
                if (ri.item() == null) continue;
                needs.merge(ri.item().getId(), ri.perPortion().multiply(BigDecimal.valueOf(i.getQuantity())), BigDecimal::add);
            }
        }
        return needs;
    }

    private static int availablePortions(List<RecipeService.ResolvedIngredient> ings, Map<Long, BigDecimal> reserved) {
        int min = Integer.MAX_VALUE;
        for (RecipeService.ResolvedIngredient ri : ings) {
            if (ri.perPortion().signum() <= 0) continue;
            BigDecimal free = nz(ri.item().getCurrentStock()).subtract(reserved.getOrDefault(ri.item().getId(), BigDecimal.ZERO));
            int p = free.signum() <= 0 ? 0 : free.divide(ri.perPortion(), 0, RoundingMode.FLOOR).intValue();
            min = Math.min(min, p);
        }
        return min == Integer.MAX_VALUE ? 0 : min;
    }

    private TableCheck lockOpen(Long checkId) {
        TableCheck c = checkRepository.findByIdForUpdate(checkId)
                .orElseThrow(() -> new ResourceNotFoundException("Adisyon bulunamadi: " + checkId));
        if (!c.isOpen()) throw new BusinessRuleException("Adisyon kapanmis (" + c.getStatus() + "); islem yapilamaz");
        return c;
    }

    private String nextCheckNo(LocalDate day) {
        String prefix = "AD-" + day.format(DAY) + "-";
        long n = checkRepository.countByCheckNoStartingWith(prefix) + 1;
        String no = prefix + String.format("%04d", n);
        while (checkRepository.existsByCheckNo(no)) {
            n++;
            no = prefix + String.format("%04d", n);
        }
        return no;
    }

    /** Adisyon acma, siparis, masa tasima, tahsilat: yalnizca Kasiyer */
    private AuthenticatedUser requirePos() {
        AuthenticatedUser actor = currentUserService.require();
        if (!currentUserService.can(Permissions.P.POS_OPERATE)) {
            throw new AccessDeniedException("Adisyon ve tahsilat islemleri Kasiyer yetkisindedir");
        }
        return actor;
    }

    /** Iptal: Kasiyer (henuz hazirlanmamis kalem) veya Mudur (iptal onayi) */
    private AuthenticatedUser requirePosOrApprover() {
        AuthenticatedUser actor = currentUserService.require();
        if (!currentUserService.can(Permissions.P.POS_OPERATE) && !currentUserService.can(Permissions.P.POS_CANCEL_APPROVE)) {
            throw new AccessDeniedException("Adisyon iptali Kasiyer veya Isletme Muduru yetkisindedir");
        }
        return actor;
    }

    /** Masa duzeni: Kasiyer, Isletme Muduru veya Yonetici (isletmeye gore degisir) */
    private void requireTableManager() {
        if (!currentUserService.can(Permissions.P.POS_TABLE_MANAGE)) {
            throw new AccessDeniedException("Masa ekleme / duzenleme Kasiyer, Isletme Muduru veya Yonetici yetkisindedir");
        }
    }

    private static String requireReason(String reason) {
        String why = reason == null ? "" : reason.trim();
        if (why.length() < 5) throw new IllegalArgumentException("Iptal gerekcesi zorunludur (en az 5 karakter)");
        if (why.length() > 200) throw new IllegalArgumentException("Gerekce en fazla 200 karakter olabilir");
        return why;
    }

    /** Kapanmamis adisyondaki kismi tahsilati gerekceyle geri alir; Isletme Muduru bilgilendirilir. */
    public Map<String, Object> voidPayment(Long paymentId, String reason) {
        AuthenticatedUser actor = requirePos();
        String why = requireReason(reason);
        CheckPayment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Tahsilat bulunamadi: " + paymentId));
        if (p.isVoided()) throw new BusinessRuleException("Bu tahsilat zaten geri alinmis");
        TableCheck c = lockOpen(p.getCheckId());
        p.setVoided(true);
        p.setVoidedBy(actor.displayName());
        p.setVoidedAt(LocalDateTime.now());
        p.setVoidReason(why);
        paymentRepository.save(p);
        auditService.log("CHECK_PAYMENT_VOIDED", "CHECK", c.getId(), p.getMethod(), "VOIDED",
                String.format("%s | Masa %d | %s TL %s | gerekce: %s", c.getCheckNo(), c.getTableNumber(),
                        p.getAmount().toPlainString(), p.getMethod(), why));
        notificationService.notify(List.of(AppRoles.MANAGER),
                "Tahsilat Geri Alindi: Masa " + c.getTableNumber(),
                String.format("%s, Masa %d adisyonundaki %s TL (%s) tahsilati geri aldi. Gerekce: %s",
                        actor.displayName(), c.getTableNumber(), ExpenseService.fmt(p.getAmount()), p.getMethod(), why),
                actor.displayName(), "CHECK_PAYMENT_VOIDED", c.getId(), "/pos", "WARNING");
        publishTables("PAYMENT_VOIDED", c.getTableNumber());
        return checkDetail(c.getId());
    }

    private static java.util.Set<Long> paidItemIdSet(List<CheckPayment> payments) {
        java.util.Set<Long> ids = new java.util.LinkedHashSet<>();
        for (CheckPayment p : payments) {
            if (p.isVoided() || p.getItemIds() == null || p.getItemIds().isBlank()) continue;
            for (String part : p.getItemIds().split(",")) {
                try { ids.add(Long.parseLong(part.trim())); } catch (NumberFormatException ignored) { /* bozuk kayit */ }
            }
        }
        return ids;
    }

    private static Map<String, Object> paymentRow(CheckPayment p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("method", p.getMethod());
        m.put("amount", p.getAmount());
        m.put("receivedAmount", p.getReceivedAmount());
        m.put("changeAmount", p.getChangeAmount());
        m.put("itemIds", p.getItemIds());
        m.put("label", p.getLabel());
        m.put("paidBy", p.getPaidBy());
        m.put("paidAt", p.getPaidAt());
        m.put("voided", p.isVoided());
        m.put("voidedBy", p.getVoidedBy());
        m.put("voidReason", p.getVoidReason());
        return m;
    }

    private BigDecimal total(List<CheckItem> items) {
        return items.stream().filter(CheckItem::isActive).map(CheckItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static Map<String, Object> tableRow(DiningTable t) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", t.getId());
        row.put("number", t.getNumber());
        row.put("label", t.label());
        row.put("area", t.getArea());
        row.put("capacity", t.getCapacity());
        row.put("active", t.getActive());
        return row;
    }

    private static String cleanArea(String area) {
        String a = area == null || area.isBlank() ? "Salon" : area.trim();
        if (a.length() > 40) throw new IllegalArgumentException("Bolum adi en fazla 40 karakter olabilir");
        return a;
    }

    private static int validCapacity(Integer capacity) {
        int c = capacity == null ? 4 : capacity;
        if (c < 1 || c > 30) throw new IllegalArgumentException("Masa kapasitesi 1-30 kisi arasinda olmalidir");
        return c;
    }

    public static boolean isBeverage(String category) {
        if (category == null) return false;
        String c = category.toLowerCase(Locale.forLanguageTag("tr"));
        return c.contains("içecek") || c.contains("icecek") || c.contains("kahve") || c.contains("çay") || c.contains("bar");
    }

    private void publishTables(String type, Integer tableNumber) {
        Map<String, Object> evt = new LinkedHashMap<>();
        evt.put("type", type);
        evt.put("tableNumber", tableNumber);
        notificationService.publish("/topic/tables", evt);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
