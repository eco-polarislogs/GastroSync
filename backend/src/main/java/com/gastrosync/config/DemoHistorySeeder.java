package com.gastrosync.config;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.model.AccountingPeriod;
import com.gastrosync.model.AppUser;
import com.gastrosync.model.CashClosing;
import com.gastrosync.model.ChatMessage;
import com.gastrosync.model.CheckItem;
import com.gastrosync.model.DiningTable;
import com.gastrosync.model.Expense;
import com.gastrosync.model.ExpensePayment;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Notification;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.model.TableCheck;
import com.gastrosync.repository.AccountingPeriodRepository;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.CashClosingRepository;
import com.gastrosync.repository.ChatMessageRepository;
import com.gastrosync.repository.CheckItemRepository;
import com.gastrosync.repository.DiningTableRepository;
import com.gastrosync.repository.ExpensePaymentRepository;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.repository.TableCheckRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.RecipeService;
import com.gastrosync.service.SalesService;

/**
 * Demo modu icin gercekci isletme gecmisi (yalnizca GASTROSYNC_SEED_DEMO_DATA=true ve
 * GASTROSYNC_SEED_DEMO_HISTORY=true iken, henuz hic adisyon yokken bir kez calisir).
 *
 * Kurgu: Istanbul'da 20 masali, kahvalti-ogle-aksam servisi yapan ust-orta segment bir restoran.
 *  - Gelir: onceki ayin basindan bugune masa adisyonlari (hafta ici / hafta sonu yogunlugu, ogun profili,
 *    odeme turu dagilimi). Her adisyon satis kaydina, satis da receteden stok tuketimine donusur.
 *  - Satilan malin maliyeti: tedarikci teslim dongulerine gore planlanan mal kabulleri (fiyat trendi ve
 *    dalgalanmasiyla), agirlikli ortalama maliyet ve fire kayitlari.
 *  - Giderler: kira, maas + SGK, elektrik, dogalgaz, su, iletisim, mali musavirlik, sarf, bakim,
 *    reklam, lojistik, POS komisyonu, sigorta ve vergi odemesi. Hedef: net satisin ~%27'si gida maliyeti,
 *    ~%33'u personel, faaliyet kari ~%15-20.
 *  - Muhasebe akisi: eski kayitlar onaylanmis -> faturalandirilip gonderilmis -> Mali Musavirce deftere
 *    islenmis; yeni kayitlar akisin farkli asamalarinda. Onceki ay kapatilmistir.
 *  - Gunluk kasa sayimlari, telsiz konusmalari, bildirimler ve bugunun acik masalari.
 * Tum tutarlar ayni kurallarla hesaplandigi icin yevmiye, KDV, Z raporu ve menu analizi tutarlidir.
 */
@Component
public class DemoHistorySeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoHistorySeeder.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal SALES_VAT = new BigDecimal("10");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final AppUserRepository userRepository;
    private final InventoryItemRepository inventoryRepository;
    private final InventoryService inventoryService;
    private final RecipeRepository recipeRepository;
    private final RecipeService recipeService;
    private final DiningTableRepository tableRepository;
    private final TableCheckRepository checkRepository;
    private final CheckItemRepository checkItemRepository;
    private final SalesRecordRepository salesRepository;
    private final StockTransactionRepository stockRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpensePaymentRepository paymentRepository;
    private final CashClosingRepository cashClosingRepository;
    private final AccountingPeriodRepository periodRepository;
    private final ChatMessageRepository chatRepository;
    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;
    private final boolean enabled;
    private final boolean demoEnabled;

    private final Random rnd = new Random(20261118L);
    private final Map<String, String> names = new HashMap<>();

    public DemoHistorySeeder(AppUserRepository userRepository, InventoryItemRepository inventoryRepository,
                             InventoryService inventoryService, RecipeRepository recipeRepository, RecipeService recipeService,
                             DiningTableRepository tableRepository, TableCheckRepository checkRepository,
                             CheckItemRepository checkItemRepository, SalesRecordRepository salesRepository,
                             StockTransactionRepository stockRepository, ExpenseRepository expenseRepository,
                             ExpensePaymentRepository paymentRepository, CashClosingRepository cashClosingRepository,
                             AccountingPeriodRepository periodRepository, ChatMessageRepository chatRepository,
                             NotificationRepository notificationRepository, ObjectMapper objectMapper,
                             PlatformTransactionManager transactionManager,
                             @Value("${gastrosync.seed.demo-data:false}") boolean demoData,
                             @Value("${gastrosync.seed.demo-history:true}") boolean demoHistory) {
        this.userRepository = userRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
        this.recipeRepository = recipeRepository;
        this.recipeService = recipeService;
        this.tableRepository = tableRepository;
        this.checkRepository = checkRepository;
        this.checkItemRepository = checkItemRepository;
        this.salesRepository = salesRepository;
        this.stockRepository = stockRepository;
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
        this.cashClosingRepository = cashClosingRepository;
        this.periodRepository = periodRepository;
        this.chatRepository = chatRepository;
        this.notificationRepository = notificationRepository;
        this.objectMapper = objectMapper;
        this.tx = new TransactionTemplate(transactionManager);
        this.enabled = demoData && demoHistory;
        this.demoEnabled = demoData;
    }

    // ── Katalog ────────────────────────────────────────────────

    /** Stok kalemi tanimi: ad, kategori, birim, baz maliyet (KDV haric), tedarikci, min stok, teslim dongusu (gun), fiyat trendi */
    record ItemDef(String name, String category, String unit, String cost, String supplier, String min, int cycle, double trend) {}

    private static final List<ItemDef> ITEMS = List.of(
            new ItemDef("Dana Antrikot", "Et & Tavuk", "kg", "450.00", "Et Dunyasi", "15", 3, 0.10),
            new ItemDef("Tavuk Gogsu", "Et & Tavuk", "kg", "180.00", "Pilic Market", "20", 3, 0.03),
            new ItemDef("Zeytinyagi (Sizma)", "Kuru Gida", "lt", "290.00", "Ege Zeytincilik", "10", 7, 0.05),
            new ItemDef("Mozzarella Peyniri", "Sut Urunleri", "kg", "320.00", "Sutcu Baba", "8", 3, 0.04),
            new ItemDef("Domates (Salkim)", "Sebze & Meyve", "kg", "45.00", "Hal Tedarik", "10", 2, -0.06),
            new ItemDef("Un (Tip 550)", "Kuru Gida", "kg", "28.00", "Degirmen A.S.", "40", 7, 0.02),
            new ItemDef("Krema (%35)", "Sut Urunleri", "lt", "115.00", "Sutcu Baba", "6", 3, 0.03),
            new ItemDef("Espresso Cekirdegi", "Icecek", "kg", "520.00", "Kahve Dunyasi", "6", 7, 0.08),
            new ItemDef("Somon Fileto", "Deniz Urunleri", "kg", "580.00", "Deniz Tedarik", "5", 3, 0.18),
            new ItemDef("Arborio Pirinci", "Kuru Gida", "kg", "110.00", "Italyan Gida", "5", 7, 0.02),
            new ItemDef("Mascarpone", "Sut Urunleri", "kg", "290.00", "Sutcu Baba", "3", 3, 0.03),
            new ItemDef("Marul", "Sebze & Meyve", "kg", "42.00", "Hal Tedarik", "4", 2, 0.04),
            new ItemDef("Dana Kıyma", "Et & Tavuk", "kg", "420.00", "Et Dunyasi", "8", 3, 0.09),
            new ItemDef("Kuzu Pirzola", "Et & Tavuk", "kg", "780.00", "Et Dunyasi", "4", 3, 0.12),
            new ItemDef("Patates", "Sebze & Meyve", "kg", "22.00", "Hal Tedarik", "15", 2, 0.02),
            new ItemDef("Soğan", "Sebze & Meyve", "kg", "18.00", "Hal Tedarik", "8", 2, 0.05),
            new ItemDef("Limon", "Sebze & Meyve", "kg", "55.00", "Hal Tedarik", "3", 2, 0.15),
            new ItemDef("Burger Ekmeği", "Firin", "adet", "9.00", "Firinci Hasan", "40", 2, 0.04),
            new ItemDef("Cheddar Peyniri", "Sut Urunleri", "kg", "360.00", "Sutcu Baba", "3", 3, 0.03),
            new ItemDef("Yumurta", "Kahvaltilik", "adet", "4.50", "Ciftlik Yumurta", "120", 3, 0.06),
            new ItemDef("Beyaz Peynir", "Sut Urunleri", "kg", "260.00", "Sutcu Baba", "4", 3, 0.03),
            new ItemDef("Siyah Zeytin", "Kahvaltilik", "kg", "210.00", "Ege Zeytincilik", "3", 7, 0.02),
            new ItemDef("Kırmızı Mercimek", "Kuru Gida", "kg", "62.00", "Degirmen A.S.", "6", 7, 0.02),
            new ItemDef("Tereyağı", "Sut Urunleri", "kg", "420.00", "Sutcu Baba", "3", 3, 0.04),
            new ItemDef("Süt", "Sut Urunleri", "lt", "38.00", "Sutcu Baba", "15", 3, 0.03),
            new ItemDef("Siyah Çay", "Icecek", "kg", "380.00", "Caykur Bayi", "2", 7, 0.02),
            new ItemDef("Türk Kahvesi (Çekirdek)", "Icecek", "kg", "640.00", "Kahve Dunyasi", "1.5", 7, 0.06),
            new ItemDef("Kola (330 ml)", "Icecek", "adet", "28.00", "Icecek Dagitim A.S.", "48", 7, 0.03),
            new ItemDef("Ayran (300 ml)", "Icecek", "adet", "14.00", "Sutcu Baba", "48", 3, 0.03),
            new ItemDef("Su (500 ml)", "Icecek", "adet", "6.00", "Icecek Dagitim A.S.", "96", 7, 0.02),
            new ItemDef("Maden Suyu (200 ml)", "Icecek", "adet", "9.00", "Icecek Dagitim A.S.", "48", 7, 0.02),
            new ItemDef("Portakal", "Sebze & Meyve", "kg", "40.00", "Hal Tedarik", "10", 2, -0.04),
            new ItemDef("Şeker", "Kuru Gida", "kg", "42.00", "Degirmen A.S.", "5", 7, 0.01),
            new ItemDef("Makarna (Penne)", "Kuru Gida", "kg", "75.00", "Italyan Gida", "6", 7, 0.02),
            new ItemDef("Bitter Çikolata", "Kuru Gida", "kg", "480.00", "Italyan Gida", "2", 7, 0.07));

    record RecipeDef(String name, String category, String price, String desc, String[][] ings) {}

    private static final List<RecipeDef> MENU = List.of(
            new RecipeDef("Mercimek Çorbası", "Başlangıç", "140.00", "Tereyağlı kırmızı mercimek çorbası, limon ile.",
                    new String[][]{{"Kırmızı Mercimek", "0.06"}, {"Soğan", "0.03"}, {"Tereyağı", "0.01"}, {"Limon", "0.01"}}),
            new RecipeDef("Patates Kızartması", "Başlangıç", "130.00", "Elma dilim, çıtır patates.",
                    new String[][]{{"Patates", "0.25"}, {"Zeytinyagi (Sizma)", "0.02"}}),
            new RecipeDef("Gurme Burger", "Ana Yemek", "450.00", "180 gr dana köfte, cheddar, karamelize soğan, patates ile.",
                    new String[][]{{"Dana Kıyma", "0.18"}, {"Burger Ekmeği", "1"}, {"Cheddar Peyniri", "0.03"}, {"Domates (Salkim)", "0.04"},
                            {"Marul", "0.03"}, {"Patates", "0.15"}}),
            new RecipeDef("Kuzu Pirzola", "Ana Yemek", "890.00", "Közde kuzu pirzola, fırın patates ile.",
                    new String[][]{{"Kuzu Pirzola", "0.30"}, {"Patates", "0.12"}, {"Zeytinyagi (Sizma)", "0.02"}}),
            new RecipeDef("Izgara Köfte", "Ana Yemek", "420.00", "Ev yapımı ızgara köfte, közlenmiş domates ve patates.",
                    new String[][]{{"Dana Kıyma", "0.20"}, {"Soğan", "0.04"}, {"Patates", "0.12"}, {"Domates (Salkim)", "0.05"}}),
            new RecipeDef("Penne Arrabbiata", "Pizza & Makarna", "330.00", "Acılı domates sosu ile penne.",
                    new String[][]{{"Makarna (Penne)", "0.13"}, {"Domates (Salkim)", "0.15"}, {"Zeytinyagi (Sizma)", "0.02"}}),
            new RecipeDef("Serpme Kahvaltı (2 Kişilik)", "Kahvaltı", "780.00", "Peynir çeşitleri, zeytin, yumurta, domates, tereyağı.",
                    new String[][]{{"Yumurta", "4"}, {"Beyaz Peynir", "0.15"}, {"Siyah Zeytin", "0.08"}, {"Domates (Salkim)", "0.15"}, {"Tereyağı", "0.04"}}),
            new RecipeDef("Menemen", "Kahvaltı", "210.00", "Tereyağında domatesli menemen.",
                    new String[][]{{"Yumurta", "3"}, {"Domates (Salkim)", "0.15"}, {"Tereyağı", "0.015"}}),
            new RecipeDef("Çikolatalı Sufle", "Tatlı", "230.00", "Akışkan bitter çikolatalı sufle.",
                    new String[][]{{"Bitter Çikolata", "0.05"}, {"Tereyağı", "0.03"}, {"Yumurta", "2"}, {"Un (Tip 550)", "0.03"}, {"Şeker", "0.04"}}),
            new RecipeDef("Çay", "İçecek", "35.00", "Demlik çay.", new String[][]{{"Siyah Çay", "0.004"}, {"Şeker", "0.005"}}),
            new RecipeDef("Türk Kahvesi", "İçecek", "95.00", "Lokum ile.", new String[][]{{"Türk Kahvesi (Çekirdek)", "0.008"}, {"Şeker", "0.005"}}),
            new RecipeDef("Espresso", "İçecek", "90.00", "Tek shot espresso.", new String[][]{{"Espresso Cekirdegi", "0.009"}}),
            new RecipeDef("Latte", "İçecek", "130.00", "Espresso ve sütlü köpük.", new String[][]{{"Espresso Cekirdegi", "0.009"}, {"Süt", "0.20"}}),
            new RecipeDef("Kola", "İçecek", "75.00", "330 ml.", new String[][]{{"Kola (330 ml)", "1"}}),
            new RecipeDef("Ayran", "İçecek", "45.00", "300 ml.", new String[][]{{"Ayran (300 ml)", "1"}}),
            new RecipeDef("Su", "İçecek", "25.00", "500 ml.", new String[][]{{"Su (500 ml)", "1"}}),
            new RecipeDef("Maden Suyu", "İçecek", "40.00", "200 ml.", new String[][]{{"Maden Suyu (200 ml)", "1"}}),
            new RecipeDef("Taze Portakal Suyu", "İçecek", "120.00", "Günlük sıkım.", new String[][]{{"Portakal", "0.45"}}));

    // ── Giris ──────────────────────────────────────────────────

    public void seedIfNeeded() {
        if (!enabled) return;
        if (checkRepository.count() > 0) return;
        long started = System.currentTimeMillis();
        try {
            loadNames();
            runAs("warehouse");
            Map<String, InventoryItem> items = tx.execute(s -> ensureCatalog());
            runAs("manager");
            Map<String, Recipe> menu = tx.execute(s -> ensureMenu(items));
            List<DiningTable> tables = tx.execute(s -> ensureTables());
            runAs("accountant");
            generateHistory(items, menu, tables);
            log.warn("DEMO gecmis verisi olusturuldu ({} sn). Uretimde GASTROSYNC_SEED_DEMO_DATA=false kullanin.",
                    (System.currentTimeMillis() - started) / 1000);
        } catch (RuntimeException ex) {
            log.error("Demo gecmis verisi olusturulamadi", ex);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void loadNames() {
        String[][] defaults = {{"admin", "Ahmet Yilmaz"}, {"manager", "Zeynep Kaya"}, {"accountant", "Canan Ozturk"},
                {"advisor", "SMMM Selim Aydin"}, {"chef", "Mehmet Sef"}, {"warehouse", "Ali Depocu"}, {"cashier", "Elif Arslan"}};
        for (String[] d : defaults) {
            names.put(d[0], userRepository.findByUsernameIgnoreCase(d[0]).map(AppUser::getName).orElse(d[1]));
        }
    }

    private void runAs(String username) {
        AppUser u = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        AuthenticatedUser au = u != null
                ? new AuthenticatedUser(u.getId(), u.getUsername(), u.getName(), AppRoles.normalize(u.getRole()))
                : new AuthenticatedUser(0L, username, names.getOrDefault(username, username), AppRoles.ADMIN);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                au, null, List.of(new SimpleGrantedAuthority("ROLE_" + au.role()))));
    }

    private Map<String, InventoryItem> ensureCatalog() {
        Map<String, InventoryItem> out = new LinkedHashMap<>();
        for (ItemDef d : ITEMS) {
            InventoryItem item = inventoryRepository.findFirstByNameIgnoreCase(d.name()).orElse(null);
            if (item == null) {
                InventoryItemRequest req = new InventoryItemRequest();
                req.setName(d.name());
                req.setCategory(d.category());
                req.setCurrentStock(BigDecimal.ZERO);
                req.setMinStock(new BigDecimal(d.min()));
                req.setUnit(d.unit());
                req.setUnitCost(new BigDecimal(d.cost()));
                req.setSupplier(d.supplier());
                item = inventoryService.createItem(req);
            }
            out.put(d.name(), item);
        }
        return out;
    }

    private Map<String, Recipe> ensureMenu(Map<String, InventoryItem> items) {
        for (RecipeDef d : MENU) {
            if (recipeRepository.existsByNameIgnoreCase(d.name())) continue;
            List<Map<String, Object>> ings = new ArrayList<>();
            for (String[] i : d.ings()) {
                InventoryItem item = items.get(i[0]);
                if (item == null) continue;
                ings.add(Map.of("itemId", item.getId(), "name", item.getName(), "quantity", new BigDecimal(i[1]), "unit", item.getUnit()));
            }
            try {
                Recipe r = new Recipe(d.name(), d.category(), new BigDecimal(d.price()), 1, d.desc(), objectMapper.writeValueAsString(ings));
                r.setVatRate(SALES_VAT);
                recipeRepository.save(r);
            } catch (Exception e) {
                throw new IllegalStateException("Demo menu kalemi olusturulamadi: " + d.name(), e);
            }
        }
        Map<String, Recipe> out = new HashMap<>();
        for (Recipe r : recipeRepository.findAll()) out.put(r.getName(), r);
        return out;
    }

    /**
     * Demo modunda masa planı hiç tanımlı değilse örnek salon düzeni (20 masa) oluşturur.
     * Mevcut veriye dokunmaz; masa varsa hiçbir şey yapmaz. Canlıda (demo kapalı) çalışmaz.
     */
    public void ensureDemoTables() {
        if (!demoEnabled || tableRepository.count() > 0) return;
        tx.executeWithoutResult(s -> {
            for (int n = 1; n <= 20; n++) {
                if (tableRepository.existsByNumber(n)) continue;
                String area = n <= 10 ? "Salon" : n <= 16 ? "Bahçe" : "Teras";
                int cap = n <= 4 ? 2 : n <= 10 ? 4 : n <= 16 ? 6 : 8;
                DiningTable t = new DiningTable(n, area, cap);
                t.setCreatedBy("Sistem (demo)");
                tableRepository.save(t);
            }
        });
        log.warn("DEMO masa planı oluşturuldu (20 masa). Canlıda masaları İşletme Müdürü tanımlar.");
    }

    private List<DiningTable> ensureTables() {
        for (int n = 1; n <= 20; n++) {
            if (tableRepository.existsByNumber(n)) continue;
            String area = n <= 10 ? "Salon" : n <= 16 ? "Bahçe" : "Teras";
            int cap = n <= 4 ? 2 : n <= 10 ? 4 : n <= 16 ? 6 : 8;
            DiningTable t = new DiningTable(n, area, cap);
            t.setCreatedBy(names.get("manager"));
            t.setCreatedAt(LocalDate.now().minusMonths(2).atTime(10, 0));
            tableRepository.save(t);
        }
        return tableRepository.findAllByOrderByNumberAsc();
    }

    // ── Talep plani ────────────────────────────────────────────

    record Line(Recipe recipe, int qty) {}
    record PlannedCheck(LocalDateTime openedAt, LocalDateTime closedAt, int guests, int table, String method,
                        List<Line> lines, Line cancelled, boolean cancelledCheck) {}

    private Recipe pick(Map<String, Recipe> menu, Object[][] weighted) {
        double total = 0;
        for (Object[] w : weighted) if (menu.containsKey((String) w[0])) total += ((Number) w[1]).doubleValue();
        if (total <= 0) return null;
        double x = rnd.nextDouble() * total;
        for (Object[] w : weighted) {
            if (!menu.containsKey((String) w[0])) continue;
            x -= ((Number) w[1]).doubleValue();
            if (x <= 0) return menu.get((String) w[0]);
        }
        return null;
    }

    private static final Object[][] MAINS = {{"Izgara Antrikot", 10}, {"Kuzu Pirzola", 6}, {"Firin Somon Fileto", 8}, {"Gurme Burger", 14},
            {"Izgara Köfte", 12}, {"Pizza Margherita", 12}, {"Tavuklu Fettuccine Alfredo", 9}, {"Mantarli Risotto", 7},
            {"Penne Arrabbiata", 7}, {"Tavuklu Sezar Salata", 6}};
    private static final Object[][] LUNCH_MAINS = {{"Gurme Burger", 16}, {"Izgara Köfte", 16}, {"Pizza Margherita", 12},
            {"Tavuklu Sezar Salata", 12}, {"Penne Arrabbiata", 10}, {"Tavuklu Fettuccine Alfredo", 9}, {"Mantarli Risotto", 6},
            {"Firin Somon Fileto", 5}, {"Izgara Antrikot", 4}};
    private static final Object[][] STARTERS = {{"Mercimek Çorbası", 10}, {"Patates Kızartması", 8}, {"Tavuklu Sezar Salata", 4}};
    private static final Object[][] DESSERTS = {{"Tiramisu", 6}, {"Çikolatalı Sufle", 5}};
    private static final Object[][] COFFEES = {{"Türk Kahvesi", 5}, {"Espresso", 3}, {"Latte", 4}};
    private static final Object[][] DRINKS = {{"Kola", 8}, {"Ayran", 6}, {"Su", 10}, {"Maden Suyu", 4}, {"Taze Portakal Suyu", 3}};

    private List<PlannedCheck> planDay(LocalDate day, int dayIndex, int totalDays, Map<String, Recipe> menu, List<DiningTable> tables,
                                       LocalDateTime cutoff) {
        double dow = switch (day.getDayOfWeek()) {
            case MONDAY -> 0.78; case TUESDAY -> 0.82; case WEDNESDAY -> 0.88; case THURSDAY -> 0.95;
            case FRIDAY -> 1.22; case SATURDAY -> 1.40; case SUNDAY -> 1.25;
        };
        boolean weekend = day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY;
        double growth = 1.0 + 0.08 * dayIndex / Math.max(1, totalDays);
        int guestsTarget = (int) Math.round(74 * dow * growth * (0.9 + rnd.nextDouble() * 0.2));
        double breakfastShare = weekend ? 0.24 : 0.07;
        double lunchShare = weekend ? 0.28 : 0.40;
        List<PlannedCheck> out = new ArrayList<>();
        int guests = 0;
        while (guests < guestsTarget) {
            int g = groupSize();
            double r = rnd.nextDouble();
            String meal = r < breakfastShare ? "B" : r < breakfastShare + lunchShare ? "L" : "D";
            LocalTime open = switch (meal) {
                case "B" -> LocalTime.of(9, 0).plusMinutes(rnd.nextInt(150));
                case "L" -> LocalTime.of(12, 0).plusMinutes(rnd.nextInt(170));
                default -> LocalTime.of(18, 30).plusMinutes(rnd.nextInt(230));
            };
            int duration = switch (meal) { case "B" -> 60 + rnd.nextInt(45); case "L" -> 35 + rnd.nextInt(40); default -> 80 + rnd.nextInt(65); };
            LocalDateTime opened = day.atTime(open);
            LocalDateTime closed = opened.plusMinutes(duration);
            if (closed.toLocalDate().isAfter(day)) closed = day.atTime(23, 55);
            guests += g;
            if (cutoff != null && closed.isAfter(cutoff)) continue;
            List<Line> lines = orderFor(meal, g, menu);
            if (lines.isEmpty()) continue;
            int table = tableFor(g, tables);
            String method = paymentFor(meal, weekend);
            Line cancelled = null;
            if (rnd.nextDouble() < 0.025) {
                Recipe c = pick(menu, DESSERTS);
                if (c != null) cancelled = new Line(c, 1);
            }
            boolean cancelledCheck = rnd.nextDouble() < 0.004;
            out.add(new PlannedCheck(opened, closed, g, table, method, lines, cancelled, cancelledCheck));
        }
        out.sort((a, b) -> a.closedAt().compareTo(b.closedAt()));
        return out;
    }

    private int groupSize() {
        double r = rnd.nextDouble();
        if (r < 0.12) return 1;
        if (r < 0.50) return 2;
        if (r < 0.68) return 3;
        if (r < 0.90) return 4;
        if (r < 0.96) return 5;
        return 6;
    }

    private int tableFor(int guests, List<DiningTable> tables) {
        List<DiningTable> fit = tables.stream().filter(t -> t.getCapacity() >= guests && Boolean.TRUE.equals(t.getActive())).toList();
        List<DiningTable> pool = fit.isEmpty() ? tables : fit;
        return pool.get(rnd.nextInt(pool.size())).getNumber();
    }

    private String paymentFor(String meal, boolean weekend) {
        double r = rnd.nextDouble();
        if ("L".equals(meal) && !weekend) return r < 0.30 ? SalesService.MEAL_CARD : r < 0.80 ? SalesService.CREDIT_CARD : SalesService.CASH;
        if ("B".equals(meal)) return r < 0.05 ? SalesService.MEAL_CARD : r < 0.63 ? SalesService.CREDIT_CARD : SalesService.CASH;
        return r < 0.05 ? SalesService.MEAL_CARD : r < 0.72 ? SalesService.CREDIT_CARD : SalesService.CASH;
    }

    private List<Line> orderFor(String meal, int guests, Map<String, Recipe> menu) {
        Map<Recipe, Integer> qty = new LinkedHashMap<>();
        java.util.function.BiConsumer<Recipe, Integer> add = (r, n) -> { if (r != null && n > 0) qty.merge(r, n, Integer::sum); };
        if ("B".equals(meal)) {
            Recipe serpme = menu.get("Serpme Kahvaltı (2 Kişilik)");
            if (serpme != null && guests >= 2 && rnd.nextDouble() < 0.75) add.accept(serpme, Math.max(1, guests / 2));
            else add.accept(menu.get("Menemen"), guests);
            if (guests % 2 == 1 && serpme != null && qty.containsKey(serpme)) add.accept(menu.get("Menemen"), 1);
            add.accept(menu.get("Çay"), (int) Math.round(guests * (1.2 + rnd.nextDouble() * 0.8)));
            for (int i = 0; i < guests; i++) {
                if (rnd.nextDouble() < 0.25) add.accept(menu.get("Taze Portakal Suyu"), 1);
                if (rnd.nextDouble() < 0.30) add.accept(menu.get("Türk Kahvesi"), 1);
            }
        } else {
            boolean lunch = "L".equals(meal);
            for (int i = 0; i < guests; i++) {
                if (rnd.nextDouble() < (lunch ? 0.30 : 0.45)) add.accept(pick(menu, STARTERS), 1);
                if (rnd.nextDouble() < 0.96) add.accept(pick(menu, lunch ? LUNCH_MAINS : MAINS), 1);
                int drinks = rnd.nextDouble() < (lunch ? 0.85 : 0.95) ? 1 : 0;
                if (!lunch && rnd.nextDouble() < 0.3) drinks++;
                for (int d = 0; d < drinks; d++) add.accept(pick(menu, DRINKS), 1);
                if (rnd.nextDouble() < (lunch ? 0.12 : 0.35)) add.accept(pick(menu, DESSERTS), 1);
                if (rnd.nextDouble() < (lunch ? 0.25 : 0.35)) add.accept(pick(menu, COFFEES), 1);
                if (lunch && rnd.nextDouble() < 0.35) add.accept(menu.get("Çay"), 1);
            }
        }
        List<Line> lines = new ArrayList<>();
        qty.forEach((r, n) -> lines.add(new Line(r, n)));
        return lines;
    }

    // ── Gecmis uretimi ─────────────────────────────────────────

    record Purchase(InventoryItem item, BigDecimal qty, BigDecimal unitCost) {}

    private void generateHistory(Map<String, InventoryItem> catalog, Map<String, Recipe> menu, List<DiningTable> tables) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDate start = today.minusMonths(1).withDayOfMonth(1);
        int totalDays = (int) ChronoUnit.DAYS.between(start, today) + 1;
        List<InventoryItem> stock = inventoryRepository.findAll();
        Map<Long, List<RecipeService.ResolvedIngredient>> resolved = new HashMap<>();
        for (Recipe r : menu.values()) resolved.put(r.getId(), recipeService.resolve(r, stock, false));
        Map<String, ItemDef> defsByName = new HashMap<>();
        for (ItemDef d : ITEMS) defsByName.put(d.name().toLowerCase(Locale.ROOT), d);

        // 1) Gun gun talep plani ve tuketim (fire dahil)
        List<List<PlannedCheck>> plan = new ArrayList<>();
        List<Map<Long, BigDecimal>> usage = new ArrayList<>();
        List<Map<Long, BigDecimal>> waste = new ArrayList<>();
        Map<Long, InventoryItem> byId = new HashMap<>();
        for (InventoryItem i : stock) byId.put(i.getId(), i);
        for (int d = 0; d < totalDays; d++) {
            LocalDate day = start.plusDays(d);
            List<PlannedCheck> checks = planDay(day, d, totalDays, menu, tables, day.equals(today) ? now.minusMinutes(10) : null);
            plan.add(checks);
            Map<Long, BigDecimal> u = new HashMap<>();
            for (PlannedCheck c : checks) {
                if (c.cancelledCheck()) continue;
                for (Line l : c.lines()) {
                    for (RecipeService.ResolvedIngredient ri : resolved.getOrDefault(l.recipe().getId(), List.of())) {
                        if (ri.item() == null) continue;
                        u.merge(ri.item().getId(), ri.perPortion().multiply(BigDecimal.valueOf(l.qty())), BigDecimal::add);
                    }
                }
            }
            Map<Long, BigDecimal> w = new HashMap<>();
            if (d % 3 == 1 && !day.equals(today)) {
                addWaste(w, catalog, "Domates (Salkim)", "0.6", "1.2");
                addWaste(w, catalog, "Marul", "0.3", "0.6");
                if (d % 6 == 1) addWaste(w, catalog, "Süt", "1", "2");
                if (d % 9 == 1) addWaste(w, catalog, "Somon Fileto", "0.2", "0.4");
            }
            w.forEach((k, v) -> u.merge(k, v, BigDecimal::add));
            usage.add(u);
            waste.add(w);
        }

        // 2) Alim plani: teslim dongusune gore ileriye donuk ihtiyac + %20 emniyet
        Map<Long, BigDecimal> virtual = new HashMap<>();
        Map<Long, BigDecimal> avgCost = new HashMap<>();
        for (InventoryItem i : stock) avgCost.put(i.getId(), basePrice(i, defsByName, 0.0));

        // Acilis stogu hareketleri gecmisin basina alinir (stok defteri sirasi tutarli olsun)
        tx.executeWithoutResult(s -> {
            for (StockTransaction st : stockRepository.findByType(StockTransaction.INBOUND)) {
                if ("Acilis stogu".equals(st.getReason()) && st.getTimestamp() != null && st.getTimestamp().isAfter(start.atStartOfDay())) {
                    st.setTimestamp(start.minusDays(1).atTime(8, 0));
                    stockRepository.save(st);
                }
            }
        });

        int[] counters = new int[3];
        for (int d = 0; d < totalDays; d++) {
            final int di = d;
            LocalDate day = start.plusDays(d);
            boolean isToday = day.equals(today);
            tx.executeWithoutResult(s -> {
                // a) Sabah mal kabulleri (tedarikci bazinda tek fatura)
                Map<String, List<Purchase>> bySupplier = new TreeMap<>();
                for (InventoryItem i : stock) {
                    ItemDef def = defsByName.get(i.getName().toLowerCase(Locale.ROOT));
                    int cycle = def != null ? def.cycle() : 7;
                    BigDecimal have = virtual.getOrDefault(i.getId(), BigDecimal.ZERO);
                    BigDecimal needSoon = BigDecimal.ZERO;
                    for (int k = di; k < Math.min(totalDays, di + cycle + 1); k++) {
                        needSoon = needSoon.add(usage.get(k).getOrDefault(i.getId(), BigDecimal.ZERO));
                    }
                    if (needSoon.signum() == 0) continue;
                    BigDecimal today0 = usage.get(di).getOrDefault(i.getId(), BigDecimal.ZERO);
                    boolean scheduled = di % cycle == Math.abs(i.getName().hashCode()) % cycle || di == 0;
                    if (!scheduled && have.compareTo(today0.multiply(new BigDecimal("1.1"))) >= 0) continue;
                    BigDecimal target = needSoon.multiply(new BigDecimal("1.2"));
                    BigDecimal qty = target.subtract(have);
                    if (qty.signum() <= 0) continue;
                    qty = roundPurchase(qty, i.getUnit());
                    double progress = (double) di / Math.max(1, totalDays - 1);
                    BigDecimal price = basePrice(i, defsByName, progress)
                            .multiply(BigDecimal.valueOf(0.975 + rnd.nextDouble() * 0.05)).setScale(2, RoundingMode.HALF_UP);
                    String supplier = i.getSupplier() == null || i.getSupplier().isBlank() || "-".equals(i.getSupplier())
                            ? "Genel Tedarik" : i.getSupplier();
                    bySupplier.computeIfAbsent(supplier, k -> new ArrayList<>()).add(new Purchase(i, qty, price));
                }
                int supplierNo = 0;
                for (Map.Entry<String, List<Purchase>> e : bySupplier.entrySet()) {
                    supplierNo++;
                    recordPurchase(day, e.getKey(), supplierNo, e.getValue(), virtual, avgCost, now);
                }

                // b) Adisyonlar -> satis -> stok tuketimi
                List<PlannedCheck> checks = plan.get(di);
                int seq = 0;
                BigDecimal cash = BigDecimal.ZERO, card = BigDecimal.ZERO, meal = BigDecimal.ZERO;
                for (PlannedCheck c : checks) {
                    seq++;
                    BigDecimal total = recordCheck(day, seq, c, resolved, virtual, avgCost, byId);
                    counters[0]++;
                    if (c.cancelledCheck()) continue;
                    switch (c.method()) {
                        case SalesService.CASH -> cash = cash.add(total);
                        case SalesService.MEAL_CARD -> meal = meal.add(total);
                        default -> card = card.add(total);
                    }
                }

                // c) Fire
                for (Map.Entry<Long, BigDecimal> w : waste.get(di).entrySet()) {
                    InventoryItem item = byId.get(w.getKey());
                    BigDecimal have = virtual.getOrDefault(item.getId(), BigDecimal.ZERO);
                    BigDecimal q = w.getValue().min(have);
                    if (q.signum() <= 0) continue;
                    BigDecimal cost = avgCost.getOrDefault(item.getId(), BigDecimal.ZERO);
                    StockTransaction st = new StockTransaction(item, StockTransaction.WASTE, q, cost,
                            wasteReason(item.getName()), "chef");
                    st.setTimestamp(day.atTime(22, 50));
                    st.setTotalAmount(q.multiply(cost).setScale(2, RoundingMode.HALF_UP));
                    virtual.put(item.getId(), have.subtract(q));
                    st.setBalanceAfter(virtual.get(item.getId()));
                    stockRepository.save(st);
                }

                // d) Gun sonu kasa sayimi (bugun haric)
                if (!isToday && !checks.isEmpty()) recordCashClosing(day, cash, card, meal);
            });
            if (d % 7 == 6) log.info("Demo gecmisi: {} / {} gun islendi ({} adisyon)", d + 1, totalDays, counters[0]);
        }

        // 3) Sabit giderler, donem kapanisi, telsiz, bildirimler, acik masalar ve stok mutabakati
        tx.executeWithoutResult(s -> {
            recordFixedExpenses(start, today, now);
            closePreviousPeriod(start, today);
            reconcileStock(stock, virtual, avgCost);
        });
        tx.executeWithoutResult(s -> {
            seedChat(today, now);
            seedNotifications(now);
        });
        runAs("cashier");
        tx.executeWithoutResult(s -> openLiveTables(menu, tables, now));
    }

    private void addWaste(Map<Long, BigDecimal> w, Map<String, InventoryItem> catalog, String name, String min, String max) {
        InventoryItem i = catalog.get(name);
        if (i == null) return;
        double lo = Double.parseDouble(min), hi = Double.parseDouble(max);
        w.merge(i.getId(), BigDecimal.valueOf(lo + rnd.nextDouble() * (hi - lo)).setScale(2, RoundingMode.HALF_UP), BigDecimal::add);
    }

    private static String wasteReason(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.contains("domates") || n.contains("marul")) return "Ezilme / tazelik kaybi (gun sonu ayiklama)";
        if (n.contains("süt") || n.contains("sut")) return "Son kullanma tarihi gecti";
        return "Hazirlik firesi (kesim / porsiyonlama)";
    }

    private BigDecimal basePrice(InventoryItem i, Map<String, ItemDef> defs, double progress) {
        ItemDef def = defs.get(i.getName().toLowerCase(Locale.ROOT));
        BigDecimal base = i.getUnitCost() != null && i.getUnitCost().signum() > 0 ? i.getUnitCost()
                : def != null ? new BigDecimal(def.cost()) : BigDecimal.ONE;
        double trend = def != null ? def.trend() : 0.02;
        return base.multiply(BigDecimal.valueOf(1 - trend / 2 + trend * progress)).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal roundPurchase(BigDecimal qty, String unit) {
        if ("adet".equalsIgnoreCase(unit)) {
            int pack = qty.compareTo(new BigDecimal("60")) > 0 ? 24 : 12;
            return qty.divide(BigDecimal.valueOf(pack), 0, RoundingMode.CEILING).multiply(BigDecimal.valueOf(pack));
        }
        return qty.multiply(new BigDecimal("2")).setScale(0, RoundingMode.CEILING).divide(new BigDecimal("2"), 1, RoundingMode.HALF_UP)
                .max(new BigDecimal("0.5"));
    }

    private void recordPurchase(LocalDate day, String supplier, int supplierNo, List<Purchase> lines,
                                Map<Long, BigDecimal> virtual, Map<Long, BigDecimal> avgCost, LocalDateTime now) {
        boolean beverage = supplier.toLowerCase(Locale.ROOT).contains("icecek");
        BigDecimal vat = beverage ? new BigDecimal("20") : BigDecimal.ONE;
        BigDecimal net = lines.stream().map(p -> p.qty().multiply(p.unitCost())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal gross = net.multiply(HUNDRED.add(vat)).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        String code = supplierCode(supplier);
        String invoice = code + day.format(DAY) + String.format("%02d", supplierNo);
        boolean cashSupplier = supplier.startsWith("Hal") || supplier.startsWith("Firin");
        int terms = cashSupplier ? 0 : supplier.startsWith("Et") || supplier.startsWith("Deniz") || supplier.startsWith("Pilic") ? 14
                : supplier.startsWith("Sut") || supplier.startsWith("Ciftlik") ? 10 : 30;

        String summary = lines.stream().map(p -> p.item().getName() + " " + p.qty().stripTrailingZeros().toPlainString() + " " + p.item().getUnit())
                .reduce((a, b) -> a + ", " + b).orElse("");
        Expense e = new Expense(supplier + " - mal alim faturasi (" + lines.size() + " kalem)", "VARIABLE", "RAW_MATERIAL",
                gross, Expense.periodOf(day), day, names.get("accountant"),
                summary.length() > 480 ? summary.substring(0, 480) + "..." : summary);
        e.setVatRate(vat);
        e.setInvoiceNumber(invoice);
        e.setCounterparty(supplier);
        e.setDueDate(day.plusDays(terms));
        e.setPaidAmount(BigDecimal.ZERO);
        applyWorkflow(e, day, cashSupplier, now);
        Expense saved = expenseRepository.save(e);
        if (!Expense.STATUS_PENDING.equals(saved.getStatus())) {
            LocalDate payDate = saved.getDueDate();
            if (!payDate.isAfter(now.toLocalDate().minusDays(cashSupplier ? 0 : 1))) {
                pay(saved, gross, cashSupplier ? ExpensePayment.CASH : ExpensePayment.BANK_TRANSFER, payDate);
            }
        }
        for (Purchase p : lines) {
            BigDecimal have = virtual.getOrDefault(p.item().getId(), BigDecimal.ZERO);
            BigDecimal oldAvg = avgCost.getOrDefault(p.item().getId(), p.unitCost());
            BigDecimal newAvg = have.signum() <= 0 ? p.unitCost()
                    : have.multiply(oldAvg).add(p.qty().multiply(p.unitCost())).divide(have.add(p.qty()), 2, RoundingMode.HALF_UP);
            avgCost.put(p.item().getId(), newAvg);
            virtual.put(p.item().getId(), have.add(p.qty()));
            StockTransaction st = new StockTransaction(p.item(), StockTransaction.INBOUND, p.qty(), p.unitCost(),
                    "Mal Kabul (Belge: " + invoice + ")", "warehouse");
            st.setTimestamp(day.atTime(8, 30).plusMinutes(supplierNo * 7L));
            st.setTotalAmount(p.qty().multiply(p.unitCost()).setScale(2, RoundingMode.HALF_UP));
            st.setDocumentNo(invoice);
            st.setReferenceType("EXPENSE");
            st.setReferenceId(saved.getId());
            st.setBalanceAfter(virtual.get(p.item().getId()));
            stockRepository.save(st);
        }
    }

    /** Muhasebe akisi: yaslandirmaya gore onay -> faturalandirip gonderme -> Mali Musavir onayi */
    private void applyWorkflow(Expense e, LocalDate date, boolean sameDayApproval, LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        long age = ChronoUnit.DAYS.between(date, today);
        boolean previousMonth = date.isBefore(today.withDayOfMonth(1));
        if (!sameDayApproval && age <= 0) {
            e.setStatus(Expense.STATUS_PENDING);
            e.setSentToAdvisor(false);
            return;
        }
        e.setApprovedBy(names.get("manager"));
        e.setApprovedAt(cap(date.plusDays(sameDayApproval ? 0 : 1).atTime(sameDayApproval ? 9 : 10, 15), now));
        if (previousMonth || age > 7) {
            e.setStatus(Expense.STATUS_FINALIZED);
            e.setSentToAdvisor(true);
            e.setSubmittedBy(names.get("accountant"));
            e.setSubmittedAt(cap(date.plusDays(2).atTime(11, 0), now));
            e.setFinalizedBy(names.get("advisor"));
            e.setFinalizedAt(cap(date.plusDays(4).atTime(15, 30), now));
            e.setRecordedInLedger(true);
            e.setAdvisorNote("e-Fatura ve irsaliye kontrol edildi");
        } else if (age >= 3) {
            e.setStatus(Expense.STATUS_APPROVED);
            e.setSentToAdvisor(true);
            e.setSubmittedBy(names.get("accountant"));
            e.setSubmittedAt(cap(date.plusDays(2).atTime(11, 0), now));
        } else {
            e.setStatus(Expense.STATUS_APPROVED);
            e.setSentToAdvisor(false);
        }
    }

    private static LocalDateTime cap(LocalDateTime t, LocalDateTime now) {
        return t.isAfter(now) ? now.minusMinutes(30) : t;
    }

    private void pay(Expense e, BigDecimal amount, String method, LocalDate date) {
        ExpensePayment p = new ExpensePayment(e.getId(), amount, method, names.get("accountant"),
                ExpensePayment.CASH.equals(method) ? "Kasadan teslimatta odendi" : "Havale / EFT");
        p.setPaymentDate(date);
        paymentRepository.save(p);
        e.setPaidAmount(e.getPaidAmount().add(amount));
        e.setLastPaymentMethod(method);
        e.refreshPaymentStatus();
        expenseRepository.save(e);
    }

    private static String supplierCode(String supplier) {
        StringBuilder sb = new StringBuilder();
        for (String part : supplier.split("[\\s.]+")) {
            if (!part.isEmpty() && Character.isLetter(part.charAt(0))) sb.append(Character.toUpperCase(part.charAt(0)));
            if (sb.length() == 3) break;
        }
        while (sb.length() < 3) sb.append('X');
        return sb.toString();
    }

    private BigDecimal recordCheck(LocalDate day, int seq, PlannedCheck c, Map<Long, List<RecipeService.ResolvedIngredient>> resolved,
                                   Map<Long, BigDecimal> virtual, Map<Long, BigDecimal> avgCost, Map<Long, InventoryItem> byId) {
        String checkNo = "AD-" + day.format(DAY) + "-" + String.format("%04d", seq);
        DiningTable table = tableRepository.findByNumber(c.table()).orElse(null);
        TableCheck check = new TableCheck();
        check.setCheckNo(checkNo);
        check.setTableId(table != null ? table.getId() : 0L);
        check.setTableNumber(c.table());
        check.setGuestCount(c.guests());
        check.setOpenedBy(names.get("cashier"));
        check.setOpenedAt(c.openedAt());
        check.setClosedBy(names.get("cashier"));
        check.setClosedAt(c.closedAt());
        if (c.cancelledCheck()) {
            check.setStatus(TableCheck.CANCELLED);
            check.setCancelReason("Musteri bekleyemedi, siparis hazirlanmadan iptal edildi");
            check.setTotalAmount(BigDecimal.ZERO);
            TableCheck savedCheck = checkRepository.save(check);
            List<CheckItem> items = new ArrayList<>();
            for (Line l : c.lines()) items.add(item(savedCheck, l, CheckItem.CANCELLED, c.openedAt().plusMinutes(4), c.closedAt(), "Musteri bekleyemedi"));
            checkItemRepository.saveAll(items);
            return BigDecimal.ZERO;
        }
        check.setStatus(TableCheck.PAID);
        check.setPaymentMethod(c.method());
        TableCheck savedCheck = checkRepository.save(check);

        List<CheckItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal vatTotal = BigDecimal.ZERO;
        String time = c.closedAt().format(HM);
        for (Line l : c.lines()) {
            items.add(item(savedCheck, l, CheckItem.SERVED, c.openedAt().plusMinutes(5 + rnd.nextInt(10)), c.closedAt().minusMinutes(10), null));
            BigDecimal unitPrice = l.recipe().getSalePrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(l.qty())).setScale(2, RoundingMode.HALF_UP);
            BigDecimal vat = lineTotal.multiply(SALES_VAT).divide(SALES_VAT.add(HUNDRED), 2, RoundingMode.HALF_UP);
            SalesRecord sale = new SalesRecord(checkNo, time, l.recipe().getName(), l.qty(), unitPrice, lineTotal, "Masa " + c.table(), c.method());
            sale.setRecipeId(l.recipe().getId());
            sale.setVatRate(SALES_VAT);
            sale.setVatAmount(vat);
            sale.setSoldAt(c.closedAt());
            sale.setStatus(SalesRecord.STATUS_COMPLETED);
            sale.setRecordedBy("cashier");
            sale = salesRepository.save(sale);
            BigDecimal lineCost = BigDecimal.ZERO;
            List<StockTransaction> txs = new ArrayList<>();
            for (RecipeService.ResolvedIngredient ri : resolved.getOrDefault(l.recipe().getId(), List.of())) {
                if (ri.item() == null) continue;
                BigDecimal used = ri.perPortion().multiply(BigDecimal.valueOf(l.qty())).setScale(3, RoundingMode.HALF_UP);
                if (used.signum() <= 0) continue;
                InventoryItem inv = byId.get(ri.item().getId());
                BigDecimal unitCost = avgCost.getOrDefault(inv.getId(), BigDecimal.ZERO);
                BigDecimal left = virtual.getOrDefault(inv.getId(), BigDecimal.ZERO).subtract(used);
                virtual.put(inv.getId(), left);
                StockTransaction st = new StockTransaction(inv, StockTransaction.OUTBOUND_SALE, used, unitCost,
                        String.format("Satis tuketimi: %s x%d (Siparis %s)", l.recipe().getName(), l.qty(), checkNo), "cashier");
                st.setTimestamp(c.closedAt());
                st.setTotalAmount(used.multiply(unitCost).setScale(2, RoundingMode.HALF_UP));
                st.setReferenceType("SALE");
                st.setReferenceId(sale.getId());
                st.setBalanceAfter(left.max(BigDecimal.ZERO));
                txs.add(st);
                lineCost = lineCost.add(st.getTotalAmount());
            }
            stockRepository.saveAll(txs);
            sale.setTotalCost(lineCost.setScale(2, RoundingMode.HALF_UP));
            sale.setUnitCost(lineCost.divide(BigDecimal.valueOf(l.qty()), 2, RoundingMode.HALF_UP));
            salesRepository.save(sale);
            total = total.add(lineTotal);
            vatTotal = vatTotal.add(vat);
        }
        if (c.cancelled() != null) {
            items.add(item(savedCheck, c.cancelled(), CheckItem.CANCELLED, c.openedAt().plusMinutes(30), c.openedAt().plusMinutes(34),
                    "Musteri vazgecti (hazirlanmadan)"));
        }
        checkItemRepository.saveAll(items);
        savedCheck.setTotalAmount(total);
        savedCheck.setVatAmount(vatTotal);
        if (SalesService.CASH.equals(c.method())) {
            BigDecimal rounded = total.divide(new BigDecimal("50"), 0, RoundingMode.CEILING).multiply(new BigDecimal("50"));
            savedCheck.setReceivedAmount(rounded);
        }
        checkRepository.save(savedCheck);
        return total;
    }

    private CheckItem item(TableCheck c, Line l, String status, LocalDateTime added, LocalDateTime changed, String cancelReason) {
        CheckItem i = new CheckItem();
        i.setCheckId(c.getId());
        i.setTableNumber(c.getTableNumber());
        i.setRecipeId(l.recipe().getId());
        i.setProductName(l.recipe().getName());
        i.setCategory(l.recipe().getCategory());
        i.setQuantity(l.qty());
        i.setUnitPrice(l.recipe().getSalePrice().setScale(2, RoundingMode.HALF_UP));
        i.setLineTotal(l.recipe().getSalePrice().multiply(BigDecimal.valueOf(l.qty())).setScale(2, RoundingMode.HALF_UP));
        i.setStatus(status);
        i.setAddedBy(names.get("cashier"));
        i.setAddedAt(added);
        i.setStatusChangedAt(changed);
        i.setStatusChangedBy(CheckItem.CANCELLED.equals(status) ? names.get("cashier") : names.get("chef"));
        i.setCancelReason(cancelReason);
        return i;
    }

    private void recordCashClosing(LocalDate day, BigDecimal cashSales, BigDecimal cardSales, BigDecimal mealSales) {
        BigDecimal opening = new BigDecimal("2500.00");
        BigDecimal paidOut = paymentRepository.findByPaymentDateBetweenOrderByCreatedAtAsc(day, day).stream()
                .filter(p -> ExpensePayment.CASH.equals(p.getMethod())).map(ExpensePayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expected = opening.add(cashSales).subtract(paidOut).setScale(2, RoundingMode.HALF_UP);
        BigDecimal diff = BigDecimal.ZERO;
        String note = "Sayim tamam, fark yok";
        double r = rnd.nextDouble();
        if (r < 0.08) {
            diff = new BigDecimal("-" + (20 + rnd.nextInt(60)));
            note = "Bozuk para / para ustu farki; vardiya sorumlusuna bildirildi";
        } else if (r < 0.12) {
            diff = new BigDecimal(10 + rnd.nextInt(30));
            note = "Bahsis kasaya karismis, ayrildi";
        }
        CashClosing c = new CashClosing();
        c.setBusinessDate(day);
        c.setOpeningFloat(opening);
        c.setCashSales(cashSales.setScale(2, RoundingMode.HALF_UP));
        c.setCashPaidOut(paidOut.setScale(2, RoundingMode.HALF_UP));
        c.setExpectedCash(expected);
        c.setCountedCash(expected.add(diff));
        c.setDifference(diff.setScale(2, RoundingMode.HALF_UP));
        c.setCardSales(cardSales.setScale(2, RoundingMode.HALF_UP));
        c.setMealCardSales(mealSales.setScale(2, RoundingMode.HALF_UP));
        c.setClosedBy(names.get("cashier"));
        c.setClosedAt(day.atTime(23, 40));
        c.setNote(note);
        cashClosingRepository.save(c);
    }

    // ── Sabit giderler ─────────────────────────────────────────

    record Fixed(int day, String title, String category, String subType, String amount, String vat, String counterparty,
                 String code, int terms, String method) {}

    private static final List<Fixed> MONTHLY = List.of(
            new Fixed(1, "Isyeri kirasi", "FIXED", "RENT", "125000.00", "0", "Kadikoy Gayrimenkul Ltd.", "KRA", 4, ExpensePayment.BANK_TRANSFER),
            new Fixed(5, "Mali musavirlik hizmet bedeli", "FIXED", "ACCOUNTANT", "18000.00", "20", "Aydin SMMM Burosu", "SMM", 10, ExpensePayment.BANK_TRANSFER),
            new Fixed(8, "Temizlik ve paketleme sarf malzemesi", "VARIABLE", "CONSUMABLES", "15600.00", "20", "Hijyen Market A.S.", "HIJ", 15, ExpensePayment.CREDIT_CARD),
            new Fixed(10, "Fiber internet ve POS hatti", "VARIABLE", "INTERNET", "1450.00", "20", "Turk Telekom", "TTK", 10, ExpensePayment.BANK_TRANSFER),
            new Fixed(10, "Isletme telefon hatlari", "VARIABLE", "PHONE", "1180.00", "20", "Turkcell", "TCL", 10, ExpensePayment.BANK_TRANSFER),
            new Fixed(12, "Sosyal medya reklam kampanyasi", "VARIABLE", "MARKETING", "21600.00", "20", "Pixel Dijital Ajans", "PXL", 15, ExpensePayment.CREDIT_CARD),
            new Fixed(14, "Davlumbaz ve kombi periyodik bakimi", "VARIABLE", "RENOVATION", "12400.00", "20", "Usta Teknik Servis", "UTS", 15, ExpensePayment.BANK_TRANSFER),
            new Fixed(15, "Sanayi tipi mutfak elektrik faturasi", "VARIABLE", "ELECTRICITY", "39600.00", "20", "Enerjisa Dagitim A.S.", "ELK", 12, ExpensePayment.BANK_TRANSFER),
            new Fixed(16, "Su faturasi", "VARIABLE", "WATER", "6900.00", "20", "ISKI", "ISK", 12, ExpensePayment.BANK_TRANSFER),
            new Fixed(17, "Endustriyel ocak dogalgaz faturasi", "VARIABLE", "GAS", "22800.00", "20", "IGDAS A.S.", "IGD", 12, ExpensePayment.BANK_TRANSFER),
            new Fixed(20, "Paket servis kurye ve nakliye", "VARIABLE", "LOGISTICS", "5400.00", "20", "Hizli Kurye Ltd.", "HKR", 10, ExpensePayment.BANK_TRANSFER),
            new Fixed(22, "Isyeri ve sorumluluk sigortasi", "FIXED", "OTHER", "7500.00", "0", "Anadolu Sigorta", "ANS", 7, ExpensePayment.CREDIT_CARD),
            new Fixed(31, "Personel maaslari", "FIXED", "LABOR", "352000.00", "0", "Personel (bordro)", "BRD", 0, ExpensePayment.BANK_TRANSFER),
            new Fixed(31, "SGK isveren primleri", "FIXED", "SGK", "81000.00", "0", "Sosyal Guvenlik Kurumu", "SGK", 26, ExpensePayment.BANK_TRANSFER),
            new Fixed(31, "Banka POS komisyonlari", "VARIABLE", "OTHER", "17800.00", "0", "Is Bankasi A.S.", "POS", 0, ExpensePayment.BANK_TRANSFER));

    private void recordFixedExpenses(LocalDate start, LocalDate today, LocalDateTime now) {
        for (YearMonth ym = YearMonth.from(start); !ym.isAfter(YearMonth.from(today)); ym = ym.plusMonths(1)) {
            for (Fixed f : MONTHLY) {
                LocalDate date = ym.atDay(Math.min(f.day(), ym.lengthOfMonth()));
                if (date.isAfter(today)) continue;
                String invoice = f.code() + "-" + ym.toString().replace("-", "") + "-" + String.format("%02d", f.day());
                Expense e = new Expense(f.title() + " (" + monthName(ym) + ")", f.category(), f.subType(), new BigDecimal(f.amount()),
                        Expense.periodOf(date), date, names.get("accountant"), null);
                e.setVatRate(new BigDecimal(f.vat()));
                e.setInvoiceNumber(invoice);
                e.setCounterparty(f.counterparty());
                e.setDueDate(date.plusDays(f.terms()));
                e.setPaidAmount(BigDecimal.ZERO);
                applyWorkflow(e, date, false, now);
                // Guncel ayda akisin her asamasindan ornekler
                if (!date.isBefore(today.withDayOfMonth(1))) {
                    switch (f.subType()) {
                        case "MARKETING" -> {
                            e.setStatus(Expense.STATUS_REJECTED);
                            e.setSentToAdvisor(false);
                            e.setRecordedInLedger(false);
                            e.setFinalizedBy(null);
                            e.setFinalizedAt(null);
                            e.setSubmittedBy(null);
                            e.setSubmittedAt(null);
                            e.setRejectionReason("e-Arsiv fatura isletme unvanina duzenlenmemis; ajanstan duzeltilmis fatura istenmeli.");
                            e.setRejectedBy(names.get("advisor"));
                            e.setRejectedAt(cap(date.plusDays(3).atTime(14, 0), now));
                        }
                        case "RENOVATION" -> {
                            e.setStatus(Expense.STATUS_APPROVED);
                            e.setSentToAdvisor(false);
                            e.setRecordedInLedger(false);
                            e.setFinalizedBy(null);
                            e.setFinalizedAt(null);
                            e.setSubmittedBy(null);
                            e.setSubmittedAt(null);
                            e.setAdvisorNote(null);
                        }
                        default -> { }
                    }
                }
                Expense saved = expenseRepository.save(e);
                boolean payable = Expense.STATUS_APPROVED.equals(saved.getStatus()) || saved.isFinalized();
                if (payable && !saved.getDueDate().isAfter(today.minusDays(1))) {
                    pay(saved, saved.getAmount(), f.method(), saved.getDueDate());
                }
            }
            // Bir onceki ayin KDV odemesi (vergi borcu kapatma; faaliyet gideri degil)
            LocalDate taxDate = ym.atDay(Math.min(26, ym.lengthOfMonth()));
            if (!taxDate.isAfter(today)) {
                Expense tax = new Expense(monthName(ym.minusMonths(1)) + " donemi KDV beyannamesi odemesi", "VARIABLE", "TAX",
                        new BigDecimal("58400.00"), Expense.periodOf(taxDate), taxDate, names.get("accountant"), "KDV tahakkuk fisi");
                tax.setVatRate(BigDecimal.ZERO);
                tax.setInvoiceNumber("KDV-" + ym.minusMonths(1).toString().replace("-", ""));
                tax.setCounterparty("Kadikoy Vergi Dairesi");
                tax.setDueDate(taxDate);
                tax.setPaidAmount(BigDecimal.ZERO);
                applyWorkflow(tax, taxDate, false, now);
                Expense saved = expenseRepository.save(tax);
                if (!Expense.STATUS_PENDING.equals(saved.getStatus())) pay(saved, saved.getAmount(), ExpensePayment.BANK_TRANSFER, taxDate);
            }
        }
        // Guncel ayda personel avansi: onay bekliyor (gorevler ayriligi ornegi)
        LocalDate adv = today.minusDays(1);
        Expense advance = new Expense("Personel maas avansi (" + monthName(YearMonth.from(today)) + ")", "FIXED", "LABOR",
                new BigDecimal("60000.00"), Expense.periodOf(adv), adv, names.get("accountant"), "Ay ortasi avans odemesi");
        advance.setVatRate(BigDecimal.ZERO);
        advance.setInvoiceNumber("AVN-" + adv.format(DAY));
        advance.setCounterparty("Personel (bordro)");
        advance.setDueDate(today.plusDays(2));
        advance.setPaidAmount(BigDecimal.ZERO);
        advance.setStatus(Expense.STATUS_PENDING);
        advance.setSentToAdvisor(false);
        expenseRepository.save(advance);
    }

    private static String monthName(YearMonth ym) {
        String[] tr = {"Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"};
        return tr[ym.getMonthValue() - 1] + " " + ym.getYear();
    }

    private void closePreviousPeriod(LocalDate start, LocalDate today) {
        YearMonth prev = YearMonth.from(today).minusMonths(1);
        if (YearMonth.from(start).isAfter(prev)) return;
        String period = prev.toString();
        boolean allSettled = expenseRepository.findByPeriod(period).stream()
                .allMatch(e -> e.isFinalized() || Expense.STATUS_REJECTED.equals(e.getStatus()));
        if (!allSettled) return;
        AccountingPeriod p = periodRepository.findByPeriod(period).orElseGet(() -> new AccountingPeriod(period));
        if (AccountingPeriod.CLOSED.equals(p.getStatus())) return;
        p.setStatus(AccountingPeriod.CLOSED);
        p.setClosedBy(names.get("advisor"));
        LocalDateTime closedAt = prev.plusMonths(1).atDay(Math.min(6, today.getDayOfMonth())).atTime(10, 30);
        p.setClosedAt(closedAt.isAfter(LocalDateTime.now()) ? LocalDateTime.now().minusHours(1) : closedAt);
        p.setNote(monthName(prev) + " donemi KDV beyannamesi verildi; tum kayitlar kesinlestirildi.");
        periodRepository.save(p);
    }

    /** Gecmis alimlardan artan miktar mevcut stoga eklenir; birim maliyet agirlikli ortalamayla guncellenir */
    private void reconcileStock(List<InventoryItem> stock, Map<Long, BigDecimal> virtual, Map<Long, BigDecimal> avgCost) {
        String ts = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
        for (InventoryItem i : stock) {
            InventoryItem item = inventoryRepository.findById(i.getId()).orElse(null);
            if (item == null) continue;
            BigDecimal left = virtual.getOrDefault(i.getId(), BigDecimal.ZERO).max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
            if (left.signum() <= 0) continue;
            BigDecimal current = item.getCurrentStock() == null ? BigDecimal.ZERO : item.getCurrentStock().max(BigDecimal.ZERO);
            BigDecimal currentCost = item.getUnitCost() == null ? BigDecimal.ZERO : item.getUnitCost();
            BigDecimal leftCost = avgCost.getOrDefault(i.getId(), currentCost);
            BigDecimal total = current.add(left);
            item.setUnitCost(current.multiply(currentCost).add(left.multiply(leftCost)).divide(total, 2, RoundingMode.HALF_UP));
            item.setCurrentStock(total);
            item.setLastUpdated(ts);
            inventoryRepository.save(item);
        }
    }

    // ── Telsiz ve bildirimler ──────────────────────────────────

    private static final String[][] CHAT = {
            {"general", "manager", "Gunaydin ekip! Bugun aksam icin {n} rezervasyon var, servis yogun gececek."},
            {"general", "manager", "Musteri memnuniyet anketinde ortalamamiz 4,7. Elinize saglik!"},
            {"general", "admin", "Yeni POS cihazlari persembe kurulacak; kurulum sirasinda Masa 1-4 kapali olacak."},
            {"kitchen", "chef", "Somon fileto bugun gec geldi, aksam servisinde porsiyon sinirli."},
            {"kitchen", "cashier", "Masa {t} siparisleri ne durumda? Misafirler soruyor."},
            {"kitchen", "chef", "Masa {t} hazir, servis edebilirsiniz."},
            {"kitchen", "cashier", "Masa {t} icin alerjen notu: fistik ve susam kesinlikle olmayacak."},
            {"kitchen", "chef", "Risotto icin arborio azaldi, yarin sabah teslimat bekliyorum."},
            {"warehouse", "warehouse", "Et Dunyasi teslimati tamam, irsaliye muhasebeye iletildi."},
            {"warehouse", "warehouse", "Hal teslimatinda domates kasalari ezik geldi; fire kaydi girildi."},
            {"warehouse", "chef", "Yarin icin 8 kg dana kiyma ve 4 kg kuzu pirzola lazim."},
            {"cashier", "cashier", "Gun sonu kasa sayimi tamamlandi, fark yok. Z raporu sisteme islendi."},
            {"cashier", "accountant", "Hal odemesi kasadan yapildi, fis muhasebede."},
            {"cashier", "cashier", "2 numarali POS cihazinda baglanti sorunu oldu, tekrar denenerek cekim yapildi."},
            {"shift", "manager", "Cumartesi aksam vardiyasina bir kisi daha ekledim."},
            {"shift", "chef", "Mutfak kapanis temizligi 23:30'da tamamlandi."},
            {"management", "accountant", "Gecen haftanin tedarikci faturalari faturalandirilip musavire gonderildi."},
            {"management", "advisor", "Ajans reklam faturasi isletme unvanina duzenlenmemis; duzeltilmis fatura istenmeli."},
            {"management", "manager", "Bu ay food cost hedefin altinda; antrikot fiyat artisini takip ediyorum."},
            {"management", "advisor", "Onceki donem kapatildi, KDV beyannamesi verildi."}};

    private void seedChat(LocalDate today, LocalDateTime now) {
        List<ChatMessage> out = new ArrayList<>();
        for (int d = 10; d >= 0; d--) {
            LocalDate day = today.minusDays(d);
            int count = 7 + rnd.nextInt(6);
            List<LocalDateTime> times = new ArrayList<>();
            for (int i = 0; i < count; i++) times.add(day.atTime(9, 0).plusMinutes(rnd.nextInt(14 * 60)));
            times.sort(null);
            for (LocalDateTime t : times) {
                if (t.isAfter(now)) continue;
                String[] tpl = CHAT[rnd.nextInt(CHAT.length)];
                String username = tpl[1];
                String name = names.getOrDefault(username, username);
                String text = tpl[2].replace("{n}", String.valueOf(6 + rnd.nextInt(10))).replace("{t}", String.valueOf(1 + rnd.nextInt(20)));
                ChatMessage m = new ChatMessage(tpl[0], name, AppRoles.normalize(roleOf(username)).toLowerCase(Locale.ROOT), text,
                        t.format(HM), initials(name), rnd.nextDouble() < 0.05 ? "urgent" : "normal");
                m.setSenderUsername(username);
                m.setCreatedAt(t);
                out.add(m);
            }
        }
        chatRepository.saveAll(out);
    }

    private static String roleOf(String username) {
        return switch (username) {
            case "admin" -> AppRoles.ADMIN;
            case "manager" -> AppRoles.MANAGER;
            case "accountant" -> AppRoles.ACCOUNTANT;
            case "advisor" -> AppRoles.FINANCIAL_ADVISOR;
            case "chef" -> AppRoles.CHEF;
            case "warehouse" -> AppRoles.WAREHOUSE;
            default -> AppRoles.CASHIER;
        };
    }

    private static String initials(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && Character.isLetter(part.charAt(0))) sb.append(Character.toUpperCase(part.charAt(0)));
            if (sb.length() == 2) break;
        }
        return sb.length() > 0 ? sb.toString() : "GS";
    }

    private void seedNotifications(LocalDateTime now) {
        Object[][] rows = {
                {"Kritik Stok: Limon", "Limon stogu minimum seviyenin altina indi. Hal teslimati bekleniyor.", "WAREHOUSE", "INVENTORY_LOW", "/inventory", "WARNING", 30},
                {"Maliyet Artisi: Somon Fileto", "Somon fileto alis fiyati son 30 gunde belirgin artti; Firin Somon Fileto icin fiyat onerisi Menu & Maliyet ekraninda.", "MANAGER", "PRICE_CHANGE", "/pricing", "WARNING", 95},
                {"Maliyet Artisi: Dana Antrikot", "Antrikot alis fiyati yukseliyor; Izgara Antrikot food cost'u izlenmeli.", "ACCOUNTANT", "PRICE_CHANGE", "/pricing", "INFO", 140},
                {"Defter Onayi Bekliyor", "Muhasebe tedarikci faturalarini faturalandirip incelemenize gonderdi.", "FINANCIAL_ADVISOR", "EXPENSE_APPROVAL", "/advisor-ledger", "WARNING", 60},
                {"Onay Bekleyen Gider: Personel maas avansi", "Personel maas avansi kaydedildi ve onay bekliyor.", "MANAGER", "EXPENSE_PENDING", "/cashier", "INFO", 200},
                {"Mali Musavir Reddetti: Sosyal medya reklam kampanyasi", "Gerekce: e-Arsiv fatura isletme unvanina duzenlenmemis. Kaydi duzeltip tekrar onaya sunun.", "ACCOUNTANT", "EXPENSE_REJECTED", "/cashier", "WARNING", 1500},
                {"Kasa Farki Bildirimi", "Gun sonu kasa sayiminda kucuk fark tespit edildi; aciklama girildi.", "MANAGER", "CASH_CLOSING", "/cashier", "INFO", 900},
                {"Yeni Mutfak Siparisi", "Masa 7 icin 4 kalem siparis mutfaga iletildi.", "CHEF", "KITCHEN_ORDER", "/kitchen", "INFO", 15},
                {"Hazir Siparis", "Masa 12 siparisi hazir, servis bekliyor.", "CASHIER", "KITCHEN_READY", "/pos", "INFO", 8}};
        List<Notification> out = new ArrayList<>();
        for (Object[] r : rows) {
            Notification n = new Notification((String) r[0], (String) r[1], (String) r[2], "Sistem", (String) r[3], null, null,
                    (String) r[4], (String) r[5]);
            n.setCreatedAt(now.minusMinutes(((Number) r[6]).longValue()));
            out.add(n);
        }
        notificationRepository.saveAll(out);
    }

    // ── Bugunun acik masalari ──────────────────────────────────

    private void openLiveTables(Map<String, Recipe> menu, List<DiningTable> tables, LocalDateTime now) {
        int hour = now.getHour();
        if (hour < 9 || hour >= 24) return;
        boolean breakfast = hour < 12;
        int[] numbers = {3, 5, 7, 9, 12, 14, 18};
        String[][] statusPlan = {{CheckItem.SERVED, CheckItem.READY}, {CheckItem.PREPARING, CheckItem.ORDERED},
                {CheckItem.SERVED, CheckItem.SERVED}, {CheckItem.ORDERED, CheckItem.ORDERED}, {CheckItem.READY, CheckItem.PREPARING},
                {CheckItem.SERVED, CheckItem.PREPARING}, {CheckItem.ORDERED, CheckItem.READY}};
        String prefix = "AD-" + now.toLocalDate().format(DAY) + "-";
        long seq = checkRepository.countByCheckNoStartingWith(prefix);
        for (int k = 0; k < numbers.length; k++) {
            int number = numbers[k];
            DiningTable t = tables.stream().filter(x -> x.getNumber() == number).findFirst().orElse(null);
            if (t == null || checkRepository.findFirstByTableIdAndStatus(t.getId(), TableCheck.OPEN).isPresent()) continue;
            int guests = Math.min(t.getCapacity(), 2 + rnd.nextInt(3));
            LocalDateTime opened = now.minusMinutes(12 + rnd.nextInt(70));
            TableCheck c = new TableCheck();
            c.setCheckNo(prefix + String.format("%04d", ++seq));
            c.setTableId(t.getId());
            c.setTableNumber(number);
            c.setGuestCount(guests);
            c.setOpenedBy(names.get("cashier"));
            c.setOpenedAt(opened);
            c.setStatus(TableCheck.OPEN);
            TableCheck saved = checkRepository.save(c);
            List<Line> lines = orderFor(breakfast ? "B" : (hour < 17 ? "L" : "D"), guests, menu);
            List<CheckItem> items = new ArrayList<>();
            for (int i = 0; i < lines.size(); i++) {
                Line l = lines.get(i);
                boolean drink = l.recipe().getCategory() != null && l.recipe().getCategory().toLowerCase(Locale.forLanguageTag("tr")).contains("içecek");
                String status = drink ? CheckItem.SERVED : statusPlan[k][i % 2];
                LocalDateTime added = opened.plusMinutes(3 + i * 2L);
                CheckItem item = item(saved, l, status, added, CheckItem.ORDERED.equals(status) ? added : added.plusMinutes(6), null);
                if (i == 0 && !drink && rnd.nextBoolean()) item.setNote("Az pismis");
                items.add(item);
            }
            checkItemRepository.saveAll(items);
        }
    }
}
