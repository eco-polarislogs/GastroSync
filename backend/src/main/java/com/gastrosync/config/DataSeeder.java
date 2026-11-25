package com.gastrosync.config;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gastrosync.dto.inventory.InventoryItemRequest;
import com.gastrosync.model.AppUser;
import com.gastrosync.model.ChatMessage;
import com.gastrosync.model.Expense;
import com.gastrosync.model.ExpensePayment;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.ChatMessageRepository;
import com.gastrosync.repository.ExpensePaymentRepository;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.PasswordPolicy;
import com.gastrosync.service.DemoAccountService;
import com.gastrosync.service.InventoryService;
import com.gastrosync.service.SalesService;

/**
 * Ilk kurulum verisi.
 *
 *  - URETIM (gastrosync.seed.demo-data=false): Bos veritabaninda yalnizca 'admin' hesabi,
 *    GASTROSYNC_ADMIN_PASSWORD ile olusturulur ve ilk giriste sifre degistirme zorunludur.
 *  - DEMO / GELISTIRME (true): Rol bazli demo kullanicilar, stok, recete, gider ve satis verisi.
 *    Demo verisi yalnizca ilgili tablo bossa yuklenir; mevcut veriye dokunulmaz.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String DEMO_PASSWORD = "123456";

    private final AppUserRepository userRepository;
    private final InventoryItemRepository inventoryRepository;
    private final RecipeRepository recipeRepository;
    private final SalesRecordRepository salesRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpensePaymentRepository paymentRepository;
    private final ChatMessageRepository chatRepository;
    private final InventoryService inventoryService;
    private final SalesService salesService;
    private final DemoAccountService demoAccountService;
    private final DemoHistorySeeder demoHistorySeeder;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final boolean demoData;
    private final String adminPassword;

    public DataSeeder(AppUserRepository userRepository, InventoryItemRepository inventoryRepository,
                      RecipeRepository recipeRepository, SalesRecordRepository salesRepository,
                      ExpenseRepository expenseRepository, ExpensePaymentRepository paymentRepository,
                      ChatMessageRepository chatRepository, InventoryService inventoryService,
                      SalesService salesService, DemoAccountService demoAccountService, DemoHistorySeeder demoHistorySeeder,
                      PasswordEncoder passwordEncoder, ObjectMapper objectMapper,
                      @Value("${gastrosync.seed.demo-data:false}") boolean demoData,
                      @Value("${gastrosync.seed.admin-password:}") String adminPassword) {
        this.userRepository = userRepository;
        this.inventoryRepository = inventoryRepository;
        this.recipeRepository = recipeRepository;
        this.salesRepository = salesRepository;
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
        this.chatRepository = chatRepository;
        this.inventoryService = inventoryService;
        this.salesService = salesService;
        this.demoAccountService = demoAccountService;
        this.demoHistorySeeder = demoHistorySeeder;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
        this.demoData = demoData;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(String... args) {
        migrateLegacyPasswords();
        if (userRepository.count() == 0) {
            if (demoData) {
                seedDemoUsers();
            } else {
                seedProductionAdmin();
            }
        }
        if (!demoData) return;
        ensureDemoUsers();
        demoAccountService.warnIfEnabled();
        try {
            seedInventory();
            seedRecipes();
            seedExpenses();
            seedSales();
            seedChat();
            demoHistorySeeder.ensureDemoTables();
        } catch (RuntimeException ex) {
            log.error("Demo verisi yuklenirken hata olustu", ex);
        }
    }

    private void migrateLegacyPasswords() {
        for (AppUser u : userRepository.findAll()) {
            String p = u.getPassword();
            if (p != null && !p.startsWith("$2a$") && !p.startsWith("$2b$") && !p.startsWith("$2y$")) {
                u.setPassword(passwordEncoder.encode(p));
                u.setMustChangePassword(true);
                userRepository.save(u);
                log.warn("Duz metin sifre BCrypt'e donusturuldu ve sifre degisikligi zorunlu kilindi: {}", u.getUsername());
            }
        }
    }

    /**
     * Demo modunda her rol icin bir demo hesabi bulunmasini garanti eder (eksik olanlar olusturulur).
     * Mevcut hesaplarin sifresine dokunulmaz.
     */
    private void ensureDemoUsers() {
        String[][] demo = {
                {"admin", "Ahmet Yilmaz", AppRoles.ADMIN},
                {"manager", "Zeynep Kaya", AppRoles.MANAGER},
                {"accountant", "Canan Ozturk", AppRoles.ACCOUNTANT},
                {"advisor", "SMMM Selim Aydin", AppRoles.FINANCIAL_ADVISOR},
                {"chef", "Mehmet Sef", AppRoles.CHEF},
                {"warehouse", "Ali Depocu", AppRoles.WAREHOUSE},
                {"cashier", "Elif Arslan", AppRoles.CASHIER}};
        String hash = null;
        for (String[] d : demo) {
            if (userRepository.findByUsernameIgnoreCase(d[0]).isPresent()) continue;
            if (hash == null) hash = passwordEncoder.encode(DEMO_PASSWORD);
            // Arsivlenmis demo hesabi varsa (kullanici adi benzersizdir) geri yuklenir
            if (userRepository.countIncludingArchived(d[0]) > 0) {
                int restored = userRepository.restoreArchived(d[0], d[2], hash);
                if (restored > 0) log.warn("Arsivlenmis demo hesabi geri yuklendi: {} ({})", d[0], d[2]);
                continue;
            }
            try {
                userRepository.save(new AppUser(d[0], hash, d[1], d[2], d[0] + "@gastrosync.local"));
                log.warn("Eksik demo hesabi olusturuldu: {} ({})", d[0], d[2]);
            } catch (RuntimeException ex) {
                log.warn("Demo hesabi olusturulamadi ({}): {}", d[0], ex.getMessage());
            }
        }
        demoAccountService.invalidate();
    }

    private void seedProductionAdmin() {
        if (adminPassword == null || adminPassword.isBlank()) {
            log.error("Veritabaninda kullanici yok ve GASTROSYNC_ADMIN_PASSWORD tanimli degil. "
                    + "Ilk yonetici hesabi olusturulamadi; degiskeni tanimlayip uygulamayi yeniden baslatin.");
            return;
        }
        PasswordPolicy.validate(adminPassword);
        AppUser admin = new AppUser("admin", passwordEncoder.encode(adminPassword), "Sistem Yoneticisi", AppRoles.ADMIN, null);
        admin.setMustChangePassword(true);
        userRepository.save(admin);
        log.info("Ilk yonetici hesabi olusturuldu (kullanici: admin). Ilk giriste sifre degistirilmesi zorunludur.");
    }

    private void seedDemoUsers() {
        String hash = passwordEncoder.encode(DEMO_PASSWORD);
        userRepository.saveAll(List.of(
                new AppUser("admin", hash, "Ahmet Yilmaz", AppRoles.ADMIN, "admin@gastrosync.local"),
                new AppUser("manager", hash, "Zeynep Kaya", AppRoles.MANAGER, "manager@gastrosync.local"),
                new AppUser("chef", hash, "Mehmet Sef", AppRoles.CHEF, "chef@gastrosync.local"),
                new AppUser("warehouse", hash, "Ali Depocu", AppRoles.WAREHOUSE, "warehouse@gastrosync.local"),
                new AppUser("accountant", hash, "Canan Ozturk", AppRoles.ACCOUNTANT, "accountant@gastrosync.local"),
                new AppUser("advisor", hash, "SMMM Selim Aydin", AppRoles.FINANCIAL_ADVISOR, "advisor@gastrosync.local"),
                new AppUser("cashier", hash, "Elif Arslan", AppRoles.CASHIER, "cashier@gastrosync.local")));
        log.warn("DEMO kullanicilari olusturuldu (sifre: {}). Uretim ortaminda GASTROSYNC_SEED_DEMO_DATA=false kullanin.", DEMO_PASSWORD);
    }

    private void seedInventory() {
        if (inventoryRepository.count() > 0) return;
        Object[][] rows = {
                {"Dana Antrikot", "Et & Tavuk", "40", "15", "kg", "450.00", "Et Dunyasi", "8690123456781"},
                {"Tavuk Gogsu", "Et & Tavuk", "35", "20", "kg", "180.00", "Pilic Market", "8690123456782"},
                {"Zeytinyagi (Sizma)", "Kuru Gida", "45", "10", "lt", "290.00", "Ege Zeytincilik", "8690123456783"},
                {"Mozzarella Peyniri", "Sut Urunleri", "18", "8", "kg", "320.00", "Sutcu Baba", "8690123456784"},
                {"Domates (Salkim)", "Sebze & Meyve", "35", "10", "kg", "45.00", "Hal Tedarik", "8690123456785"},
                {"Un (Tip 550)", "Kuru Gida", "120", "40", "kg", "28.00", "Degirmen A.S.", "8690123456786"},
                {"Krema (%35)", "Sut Urunleri", "20", "6", "lt", "115.00", "Sutcu Baba", "8690123456787"},
                {"Espresso Cekirdegi", "Icecek", "8", "6", "kg", "520.00", "Kahve Dunyasi", "8690123456788"},
                {"Somon Fileto", "Deniz Urunleri", "12", "5", "kg", "580.00", "Deniz Tedarik", "8690123456789"},
                {"Arborio Pirinci", "Kuru Gida", "15", "5", "kg", "110.00", "Italyan Gida", "8690123456790"},
                {"Mascarpone", "Sut Urunleri", "6", "3", "kg", "290.00", "Sutcu Baba", "8690123456791"},
                {"Marul", "Sebze & Meyve", "10", "4", "kg", "42.00", "Hal Tedarik", "8690123456792"}
        };
        for (Object[] r : rows) {
            InventoryItemRequest req = new InventoryItemRequest();
            req.setName((String) r[0]);
            req.setCategory((String) r[1]);
            req.setCurrentStock(new BigDecimal((String) r[2]));
            req.setMinStock(new BigDecimal((String) r[3]));
            req.setUnit((String) r[4]);
            req.setUnitCost(new BigDecimal((String) r[5]));
            req.setSupplier((String) r[6]);
            req.setBarcode((String) r[7]);
            inventoryService.createItem(req);
        }
        log.info("Demo stok kartlari acilis hareketleriyle olusturuldu");
    }

    private void seedRecipes() {
        if (recipeRepository.count() > 0) return;
        recipe("Izgara Antrikot", "Ana Yemek", "680.00",
                "28 gun dinlendirilmis dana antrikot, mevsim sebzeleri ile.",
                ing("Dana Antrikot", "0.25"), ing("Zeytinyagi (Sizma)", "0.03"), ing("Krema (%35)", "0.05"));
        recipe("Pizza Margherita", "Pizza & Makarna", "340.00",
                "48 saat mayalanmis hamur, domates sosu ve mozzarella.",
                ing("Un (Tip 550)", "0.22"), ing("Domates (Salkim)", "0.15"), ing("Mozzarella Peyniri", "0.14"), ing("Zeytinyagi (Sizma)", "0.02"));
        recipe("Tavuklu Fettuccine Alfredo", "Pizza & Makarna", "390.00",
                "El yapimi fettuccine, izgara tavuk ve kremali sos.",
                ing("Tavuk Gogsu", "0.18"), ing("Krema (%35)", "0.10"), ing("Un (Tip 550)", "0.15"));
        recipe("Firin Somon Fileto", "Deniz Urunleri", "540.00",
                "Firinlanmis somon, limonlu tereyag sos ile.",
                ing("Somon Fileto", "0.22"), ing("Zeytinyagi (Sizma)", "0.02"), ing("Domates (Salkim)", "0.06"));
        recipe("Mantarli Risotto", "Ana Yemek", "420.00",
                "Arborio pirinci, krema ve zeytinyagi ile.",
                ing("Arborio Pirinci", "0.11"), ing("Krema (%35)", "0.08"), ing("Zeytinyagi (Sizma)", "0.02"));
        recipe("Tavuklu Sezar Salata", "Salata", "260.00",
                "Marul, izgara tavuk ve ev yapimi sezar sos.",
                ing("Marul", "0.12"), ing("Tavuk Gogsu", "0.13"), ing("Zeytinyagi (Sizma)", "0.015"));
        recipe("Tiramisu", "Tatli", "220.00",
                "Espresso ile islatilmis kedi dili ve mascarpone kremasi.",
                ing("Mascarpone", "0.09"), ing("Espresso Cekirdegi", "0.02"), ing("Krema (%35)", "0.05"));
        log.info("Demo receteleri olusturuldu");
    }

    private Map<String, Object> ing(String name, String qty) {
        InventoryItem item = inventoryRepository.findFirstByNameIgnoreCase(name)
                .orElseThrow(() -> new IllegalStateException("Demo malzeme bulunamadi: " + name));
        return Map.of("itemId", item.getId(), "name", item.getName(), "quantity", new BigDecimal(qty), "unit", item.getUnit());
    }

    @SafeVarargs
    private void recipe(String name, String category, String price, String desc, Map<String, Object>... ings) {
        try {
            Recipe r = new Recipe(name, category, new BigDecimal(price), 1, desc, objectMapper.writeValueAsString(List.of(ings)));
            r.setVatRate(new BigDecimal("10"));
            recipeRepository.save(r);
        } catch (Exception e) {
            throw new IllegalStateException("Demo recete olusturulamadi: " + name, e);
        }
    }

    private void seedExpenses() {
        if (expenseRepository.count() > 0) return;
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        // Kesinlesmis (deftere islenmis) ve odenmis kira
        Expense rent = expense("Merkez Restoran Kirasi", "FIXED", "RENT", "45000.00", "0", monthStart, "KRA-" + monthStart.getYear() + "/" + monthStart.getMonthValue(), "Mulk Sahibi Mehmet Bey");
        rent.setStatus(Expense.STATUS_FINALIZED);
        rent.setRecordedInLedger(true);
        rent.setApprovedBy("Zeynep Kaya");
        rent.setFinalizedBy("SMMM Selim Aydin");
        pay(expenseRepository.save(rent), "45000.00", ExpensePayment.BANK_TRANSFER);

        // Onaylanmis, Mali Musavir incelemesinde, odenmemis elektrik
        Expense electricity = expense("Sanayi Tipi Mutfak Elektrik Faturasi", "VARIABLE", "ELECTRICITY", "14200.00", "20", today, "ELK-8839210", "Enerjisa Dagitim A.S.");
        electricity.setStatus(Expense.STATUS_APPROVED);
        electricity.setSentToAdvisor(true);
        electricity.setApprovedBy("Zeynep Kaya");
        electricity.setDueDate(today.plusDays(10));
        expenseRepository.save(electricity);

        // Onay bekleyen dogalgaz
        Expense gas = expense("Endustriyel Ocak Dogalgaz Tuketimi", "VARIABLE", "GAS", "9600.00", "20", today, "IGD-9921", "IGDAS A.S.");
        gas.setDueDate(today.plusDays(14));
        expenseRepository.save(gas);

        // Belgesi eksik oldugu icin reddedilmis reklam gideri
        Expense ad = expense("Instagram Tanitim Reklami", "VARIABLE", "MARKETING", "5000.00", "20", today, null, "Dijital Ajans");
        ad.setStatus(Expense.STATUS_REJECTED);
        ad.setRejectionReason("Resmi e-Arsiv fatura PDF'i eklenmemis; fatura isletme unvanina duzenlenmeli.");
        ad.setRejectedBy("SMMM Selim Aydin");
        expenseRepository.save(ad);
        log.info("Demo gider kayitlari olusturuldu");
    }

    private Expense expense(String title, String cat, String sub, String amount, String vat, LocalDate date, String invoice, String counterparty) {
        Expense e = new Expense(title, cat, sub, new BigDecimal(amount), null, date, "Canan Ozturk", null);
        e.setVatRate(new BigDecimal(vat));
        e.setInvoiceNumber(invoice);
        e.setCounterparty(counterparty);
        e.setDueDate(date);
        return e;
    }

    private void pay(Expense e, String amount, String method) {
        paymentRepository.save(new ExpensePayment(e.getId(), new BigDecimal(amount), method, "Canan Ozturk", "Demo odeme"));
        e.setPaidAmount(new BigDecimal(amount));
        e.setLastPaymentMethod(method);
        e.refreshPaymentStatus();
        expenseRepository.save(e);
    }

    private void seedSales() {
        if (salesRepository.count() > 0) return;
        List<Recipe> recipes = recipeRepository.findAll();
        if (recipes.isEmpty()) return;
        String[][] orders = {
                {"Masa 4", "CREDIT_CARD", "Izgara Antrikot", "2"},
                {"Masa 12", "CASH", "Pizza Margherita", "1"},
                {"Masa 7", "MEAL_CARD", "Tavuklu Fettuccine Alfredo", "2"},
                {"Masa 2", "CREDIT_CARD", "Tiramisu", "3"},
                {"Masa 9", "CASH", "Tavuklu Sezar Salata", "2"}
        };
        for (String[] o : orders) {
            salesService.recordOrder(o[0], o[1], null, List.of(new SalesService.OrderLine(null, o[2], Integer.valueOf(o[3]))));
        }
        log.info("Demo POS satislari receteden stok dusumuyle olusturuldu");
    }

    private void seedChat() {
        if (chatRepository.count() > 0) return;
        chatRepository.saveAll(List.of(
                new ChatMessage("general", "Zeynep Kaya", "manager", "Gunaydin ekip! Bugun 20:00'de 8 kisilik rezervasyon var.", "09:00", "ZK", "normal"),
                new ChatMessage("kitchen", "Mehmet Sef", "chef", "Mozzarella stogu azaliyor, aksam servisinden once kontrol edelim.", "10:15", "MS", "normal"),
                new ChatMessage("cashier", "Canan Ozturk", "accountant", "Elektrik faturasi onaylandi, vadesi geldiginde odenecek.", "11:00", "CO", "normal")));
    }
}
