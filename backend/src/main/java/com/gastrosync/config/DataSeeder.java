package com.gastrosync.config;

import com.gastrosync.model.AppUser;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.RecipeRepository;
import com.gastrosync.repository.SalesRecordRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository userRepository;
    private final InventoryItemRepository inventoryRepository;
    private final RecipeRepository recipeRepository;
    private final SalesRecordRepository salesRepository;

    public DataSeeder(AppUserRepository userRepository, 
                      InventoryItemRepository inventoryRepository,
                      RecipeRepository recipeRepository,
                      SalesRecordRepository salesRepository) {
        this.userRepository = userRepository;
        this.inventoryRepository = inventoryRepository;
        this.recipeRepository = recipeRepository;
        this.salesRepository = salesRepository;
    }

    @Override
    public void run(String... args) {
        seedUsers();
        seedInventory();
        seedRecipes();
        seedSales();
    }

    private void seedUsers() {
        if (userRepository.count() == 0) {
            userRepository.saveAll(List.of(
                new AppUser("admin", "123456", "Ahmet Yılmaz", "ADMIN", "admin@gastrosync.com"),
                new AppUser("manager", "123456", "Zeynep Kaya", "MANAGER", "manager@gastrosync.com"),
                new AppUser("chef", "123456", "Mehmet Şef", "CHEF", "chef@gastrosync.com"),
                new AppUser("warehouse", "123456", "Ali Depocu", "WAREHOUSE", "warehouse@gastrosync.com")
            ));
            System.out.println("✅ Mock Users seeded successfully.");
        }
    }

    private void seedInventory() {
        if (inventoryRepository.count() == 0) {
            inventoryRepository.saveAll(List.of(
                new InventoryItem("Dana Antrikot", "Et & Tavuk", new BigDecimal("12.5"), new BigDecimal("15.0"), "kg", new BigDecimal("450.00"), "Et Dünyası", "8690123456781", "Bugün 09:30"),
                new InventoryItem("Tavuk Göğsü", "Et & Tavuk", new BigDecimal("28.0"), new BigDecimal("20.0"), "kg", new BigDecimal("180.00"), "Piliç Market", "8690123456782", "Bugün 10:15"),
                new InventoryItem("Zeytinyağı (Sızma)", "Kuru Gıda", new BigDecimal("45.0"), new BigDecimal("30.0"), "lt", new BigDecimal("290.00"), "Ege Zeytincilik", "8690123456783", "Dün"),
                new InventoryItem("Mozzarella Peyniri", "Süt Ürünleri", new BigDecimal("8.0"), new BigDecimal("10.0"), "kg", new BigDecimal("320.00"), "Sütçü Baba", "8690123456784", "Bugün 11:00"),
                new InventoryItem("Domates (Salkım)", "Sebze & Meyve", new BigDecimal("35.0"), new BigDecimal("25.0"), "kg", new BigDecimal("45.00"), "Hal Tedarik", "8690123456785", "Bugün 08:00"),
                new InventoryItem("Un (Tip 550)", "Kuru Gıda", new BigDecimal("120.0"), new BigDecimal("50.0"), "kg", new BigDecimal("28.00"), "Değirmen A.Ş.", "8690123456786", "2 gün önce"),
                new InventoryItem("Krema (%35)", "Süt Ürünleri", new BigDecimal("14.0"), new BigDecimal("12.0"), "lt", new BigDecimal("115.00"), "Sütçü Baba", "8690123456787", "Dün"),
                new InventoryItem("Espresso Çekirdeği", "İçecek", new BigDecimal("6.5"), new BigDecimal("10.0"), "kg", new BigDecimal("520.00"), "Kahve Dünyası", "8690123456788", "Bugün 12:45")
            ));
            System.out.println("✅ Mock Inventory items seeded successfully.");
        }
    }

    private void seedRecipes() {
        if (recipeRepository.count() == 0) {
            recipeRepository.saveAll(List.of(
                new Recipe("Izgara Antrikot", "Ana Yemek", new BigDecimal("680.00"), 1, 
                    "28 gün dinlendirilmiş 250gr dana antrikot, trüflü patates püresi ve mevsim sebzeleri ile.",
                    "[{\"name\":\"Dana Antrikot\",\"quantity\":0.25,\"unit\":\"kg\",\"unitCost\":450.00,\"cost\":112.50},{\"name\":\"Zeytinyağı\",\"quantity\":0.03,\"unit\":\"lt\",\"unitCost\":290.00,\"cost\":8.70},{\"name\":\"Krema\",\"quantity\":0.05,\"unit\":\"lt\",\"unitCost\":115.00,\"cost\":5.75}]"),
                new Recipe("Pizza Margherita", "Pizza & Makarna", new BigDecimal("340.00"), 1,
                    "İtalyan unundan 48 saat mayalanmış hamur, San Marzano domates sosu ve manda mozzarella.",
                    "[{\"name\":\"Un (Tip 550)\",\"quantity\":0.22,\"unit\":\"kg\",\"unitCost\":28.00,\"cost\":6.16},{\"name\":\"Domates (Salkım)\",\"quantity\":0.15,\"unit\":\"kg\",\"unitCost\":45.00,\"cost\":6.75},{\"name\":\"Mozzarella Peyniri\",\"quantity\":0.14,\"unit\":\"kg\",\"unitCost\":320.00,\"cost\":44.80},{\"name\":\"Zeytinyağı\",\"quantity\":0.02,\"unit\":\"lt\",\"unitCost\":290.00,\"cost\":5.80}]"),
                new Recipe("Tavuklu Fettuccine Alfredo", "Pizza & Makarna", new BigDecimal("390.00"), 1,
                    "Taze el yapımı fettuccine makarna, ızgara tavuk dilimleri ve zengin parmesan kremalı sos.",
                    "[{\"name\":\"Tavuk Göğsü\",\"quantity\":0.18,\"unit\":\"kg\",\"unitCost\":180.00,\"cost\":32.40},{\"name\":\"Krema (%35)\",\"quantity\":0.1,\"unit\":\"lt\",\"unitCost\":115.00,\"cost\":11.50},{\"name\":\"Un (Tip 550)\",\"quantity\":0.15,\"unit\":\"kg\",\"unitCost\":28.00,\"cost\":4.20}]")
            ));
            System.out.println("✅ Mock Recipes seeded successfully.");
        }
    }

    private void seedSales() {
        if (salesRepository.count() == 0) {
            salesRepository.saveAll(List.of(
                new SalesRecord("ORD-2024-001", "12:14", "Izgara Antrikot", 2, new BigDecimal("680.00"), new BigDecimal("1360.00"), "Masa 4", "Kredi Kartı"),
                new SalesRecord("ORD-2024-002", "12:22", "Pizza Margherita", 1, new BigDecimal("340.00"), new BigDecimal("340.00"), "Masa 12", "Kredi Kartı"),
                new SalesRecord("ORD-2024-003", "12:35", "Tavuklu Fettuccine Alfredo", 3, new BigDecimal("390.00"), new BigDecimal("1170.00"), "Masa 7", "Nakit"),
                new SalesRecord("ORD-2024-004", "13:05", "Izgara Antrikot", 1, new BigDecimal("680.00"), new BigDecimal("680.00"), "Masa 2", "Kredi Kartı"),
                new SalesRecord("ORD-2024-005", "13:18", "Pizza Margherita", 2, new BigDecimal("340.00"), new BigDecimal("680.00"), "Masa 9", "Yemek Kartı"),
                new SalesRecord("ORD-2024-006", "13:42", "Tavuklu Fettuccine Alfredo", 1, new BigDecimal("390.00"), new BigDecimal("390.00"), "Masa 5", "Kredi Kartı")
            ));
            System.out.println("✅ Mock Sales seeded successfully.");
        }
    }
}
