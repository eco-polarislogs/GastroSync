package com.gastrosync.controller;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.auth.AuthResponse;
import com.gastrosync.dto.auth.LoginRequest;
import com.gastrosync.dto.user.UserCreateRequest;
import com.gastrosync.dto.user.UserResponse;
import com.gastrosync.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for User entity administration and management.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DECISIONS & SOLID PRINCIPLES (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. SINGLE RESPONSIBILITY PRINCIPLE (SRP):
 *    - This controller is an HTTP adapter ONLY. It handles:
 *      * Request routing & method mapping
 *      * Parameter extraction & validation (@Valid)
 *      * HTTP status codes (200, 201, 204)
 *      * Response serialization into standard ApiResponse DTOs
 *    - ZERO business logic, ZERO direct database interaction, and NO password handling.
 *      All logic is encapsulated within UserService.
 *
 * 2. ROLE-BASED ACCESS CONTROL (RBAC):
 *    - Uses @PreAuthorize with Spring Security expressions:
 *      * Listing & viewing users: ADMIN and MANAGER
 *      * Creating, role-changing, or deleting users: ADMIN ONLY
 *    - Enforced at method entry by Spring Security AOP proxy.
 *
 * 3. DATA TRANSFER OBJECT (DTO) PROJECTION:
 *    - Never returns the AppUser domain model directly (OWASP A01: Broken Object Level Authorization
 *      & Sensitive Data Exposure). All inputs use UserCreateRequest, all outputs use UserResponse.
 *
 * 4. BACKWARD COMPATIBILITY:
 *    - Supports the legacy POST /api/users/login route while the frontend is transitioning
 *      to the modern /api/auth/login endpoint.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Lists all active users in the system.
     * Restricted to ADMIN and MANAGER roles.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        List<UserResponse> users = userService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.ok("Kullanıcılar başarıyla getirildi", users));
    }

    /**
     * Retrieves details for a specific user by ID.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable("id") Long id) {
        UserResponse user = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    /**
     * Creates a new user with BCrypt hashed password and validated role.
     * Restricted strictly to ADMIN role.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody UserCreateRequest request) {
        UserResponse createdUser = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Kullanıcı başarıyla oluşturuldu", createdUser));
    }

    /**
     * Updates an existing user's role.
     * Restricted strictly to ADMIN role.
     */
    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> payload) {

        String newRole = payload.get("role");
        if (newRole == null || newRole.trim().isEmpty()) {
            throw new IllegalArgumentException("Yeni rol belirtilmelidir");
        }

        UserResponse updated = userService.updateUserRole(id, newRole);
        return ResponseEntity.ok(ApiResponse.ok("Kullanıcı rolü güncellendi", updated));
    }

    /**
     * Deletes a user by ID.
     * Safety rule: The system prevents deleting the root admin account.
     * Restricted strictly to ADMIN role.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteUser(@PathVariable("id") Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.ok("Kullanıcı sistemden başarıyla silindi", Map.of("id", id)));
    }

    /**
     * Legacy login endpoint kept for backward compatibility with frontend/mobile clients.
     * Delegates internally to the secure UserService authentication engine.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> legacyLogin(@RequestBody LoginRequest credentials) {
        AuthResponse response = userService.authenticate(credentials);
        return ResponseEntity.ok(response);
    }
}
