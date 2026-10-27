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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * Controller dedicated strictly to Authentication & Identity operations.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL JUSTIFICATION (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * WHY a separate AuthController from UserController?
 * ───────────────────────────────────────────────────
 * 1. SINGLE RESPONSIBILITY PRINCIPLE (SRP):
 *    - AuthController handles authentication concerns: token issuance, credential
 *      validation, self-identity (/me). It does not care about user management.
 *    - UserController handles administrative CRUD operations on user entities:
 *      listing users, changing roles, disabling accounts.
 *
 * 2. SECURITY PRIVILEGE BOUNDARIES:
 *    - AuthController endpoints (/api/auth/**) are largely public (login/register).
 *    - UserController endpoints (/api/users/**) are private, protected by RBAC
 *      guards (e.g. @PreAuthorize("hasRole('ADMIN')")).
 *    - Mixing public login and privileged admin routes in the same class creates
 *      accidental authorization leakage risks.
 *
 * 3. OPEN/CLOSED & REST CONVENTIONS:
 *    - /api/auth aligns with industry standards (OAuth2/OIDC/RFC 6749 conventions),
 *      making API consumers (React, React Native, Postman) predictable and clean.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Authenticates a user with username/email and password, issuing a JWT.
     *
     * @param request Validated login credentials
     * @return 200 OK with JWT token and user profile, or 400/401 on failure
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = userService.authenticate(request);
        return ResponseEntity.ok(ApiResponse.ok("Giriş başarılı", response));
    }

    /**
     * Registers a new user account.
     *
     * @param request Validated user registration details
     * @return 201 CREATED with the created user metadata
     */
    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody UserCreateRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Kullanıcı kaydı başarıyla tamamlandı", response));
    }

    /**
     * Returns the profile of the currently authenticated user based on the JWT token.
     *
     * @return 200 OK with the authenticated user's details
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = authentication.getName();

        UserResponse user = userService.getUserByUsername(currentUsername);
        return ResponseEntity.ok(ApiResponse.ok("Kullanıcı profili getirildi", user));
    }
}
