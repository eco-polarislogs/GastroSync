package com.gastrosync;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.mapper.ExpenseMapper;
import com.gastrosync.model.Expense;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.Recipe;
import com.gastrosync.model.RecipeIngredient;
import com.gastrosync.security.JwtTokenProvider;

@SpringBootTest
class GastroSyncApplicationTests {

    @Autowired(required = false)
    private PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private JwtTokenProvider jwtTokenProvider;

    @Autowired(required = false)
    private ExpenseMapper expenseMapper;

    @Test
    @DisplayName("1. Spring Application Context Loads Successfully")
    void contextLoads() {
        assertNotNull(passwordEncoder, "PasswordEncoder should be present in ApplicationContext");
        assertNotNull(jwtTokenProvider, "JwtTokenProvider should be present in ApplicationContext");
        assertNotNull(expenseMapper, "ExpenseMapper should be generated and present in ApplicationContext");
    }

    @Test
    @DisplayName("2. BCrypt Password Hashing & Salt Verification")
    void testPasswordHashing() {
        String rawPassword = "SecurePassword123!";
        String encoded = passwordEncoder.encode(rawPassword);

        assertNotNull(encoded);
        assertTrue(encoded.startsWith("$2a$") || encoded.startsWith("$2b$"), "BCrypt format must be valid");
        assertTrue(passwordEncoder.matches(rawPassword, encoded), "BCrypt must verify matches correctly");
        assertFalse(passwordEncoder.matches("WrongPassword", encoded), "BCrypt must reject invalid passwords");
    }

    @Test
    @DisplayName("3. JWT Token Generation, Claims Extraction & Validation")
    void testJwtLifecycle() {
        Long userId = 1L;
        String username = "admin";
        String role = "ADMIN";
        String name = "Ahmet Yılmaz";

        String token = jwtTokenProvider.generateToken(userId, username, role, name);
        assertNotNull(token);
        assertTrue(jwtTokenProvider.validateToken(token), "JWT Token must be valid");
        assertEquals(username, jwtTokenProvider.getUsername(token), "Username claim must match");
        assertEquals(role, jwtTokenProvider.getRole(token), "Role claim must match");
        assertEquals(userId, jwtTokenProvider.getUserId(token), "UserId claim must match");
    }

    @Test
    @DisplayName("4. MapStruct DTO Projection & Field Mapping")
    void testMapStructProjection() {
        Expense entity = new Expense();
        entity.setId(100L);
        entity.setTitle("Sanayi Tipi Elektrik");
        entity.setCategory("VARIABLE");
        entity.setSubType("ELECTRICITY");
        entity.setAmount(new BigDecimal("15400.50"));
        entity.setExpenseDate(LocalDate.now());
        entity.setStatus("PENDING_APPROVAL");

        ExpenseResponse response = expenseMapper.toDto(entity);
        assertNotNull(response);
        assertEquals(entity.getId(), response.getId());
        assertEquals(entity.getTitle(), response.getTitle());
        assertEquals(entity.getCategory(), response.getCategory());
        assertEquals(entity.getAmount(), response.getAmount());
        assertEquals("PENDING_APPROVAL", response.getStatus());
    }

    @Test
    @DisplayName("5. Recipe Ingredient Cost Mathematical Accuracy")
    void testRecipeIngredientCostCalculation() {
        InventoryItem beef = new InventoryItem("Dana Antrikot", "Et", new BigDecimal("10.0"), new BigDecimal("15.0"), "kg", new BigDecimal("450.00"), "Et Dünyası", "8690123456781", "Bugün");
        Recipe recipe = new Recipe("Izgara Antrikot", "Ana Yemek", new BigDecimal("680.00"), 1, "Açıklama", "[]");
        
        // 250g = 0.250 kg at 450 TL/kg = 112.50 TL
        RecipeIngredient ingredient = new RecipeIngredient(recipe, beef, new BigDecimal("0.250"), "kg");
        BigDecimal calculatedCost = ingredient.calculateCost();

        assertEquals(0, new BigDecimal("112.50").compareTo(calculatedCost), "Calculated cost must be mathematically equal to 112.50 TL");
    }
}
