package com.gastrosync.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Data Transfer Object for login requests.
 *
 * WHY a dedicated DTO instead of Map<String, String>?
 * ───────────────────────────────────────────────────
 * 1. TYPE SAFETY: The compiler ensures only valid fields are accessed.
 *    Map.get("usernme") would silently return null — a DTO field "username" is checked at compile time.
 * 2. VALIDATION: jakarta.validation annotations (@NotBlank, @Size) are applied here,
 *    not scattered across controller code. When paired with @Valid on the controller
 *    parameter, Spring automatically validates and returns 400 Bad Request with details.
 * 3. DOCUMENTATION: The DTO's fields serve as self-documenting API contracts.
 *    Swagger/OpenAPI reads these annotations to generate accurate API docs.
 * 4. SECURITY: We explicitly define what the client CAN send. With Map<String,String>,
 *    the client could inject unexpected fields (mass assignment vulnerability).
 *
 * THESIS NOTE: This implements the "Data Transfer Object" pattern (Martin Fowler, PoEAA).
 * DTOs decouple the API contract from the internal domain model, allowing each to
 * evolve independently.
 */
public class LoginRequest {

    @com.fasterxml.jackson.annotation.JsonAlias({"username", "email"})
    @NotBlank(message = "Kullanıcı adı veya e-posta zorunludur")
    private String identifier;

    @NotBlank(message = "Şifre zorunludur")
    @Size(min = 4, message = "Şifre en az 4 karakter olmalıdır")
    private String password;

    public LoginRequest() {}

    public LoginRequest(String identifier, String password) {
        this.identifier = identifier;
        this.password = password;
    }

    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }

    // Helper for direct username mapping if needed
    public String getUsername() { return identifier; }
    public void setUsername(String username) { this.identifier = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
