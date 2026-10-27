package com.gastrosync.dto.auth;

import java.time.LocalDateTime;

/**
 * Response DTO for successful authentication.
 *
 * WHY a dedicated AuthResponse instead of returning the AppUser entity?
 * ─────────────────────────────────────────────────────────────────────
 * 1. SECURITY: The AppUser entity contains the hashed password field.
 *    Returning it directly would leak the hash to the frontend — even though
 *    BCrypt hashes are computationally expensive to crack, exposing them
 *    violates the principle of LEAST PRIVILEGE.
 * 2. ENCAPSULATION: The frontend needs specific fields (token, role, name).
 *    The entity may have fields the frontend should never see (internal IDs,
 *    audit timestamps, soft-delete flags).
 * 3. API STABILITY: If we refactor the AppUser entity (rename a field, add
 *    a relationship), the API contract (this DTO) remains unchanged.
 *    This is the ADAPTER PATTERN — the DTO adapts the internal model to the
 *    external API contract.
 *
 * WHAT does the frontend do with this response?
 * ──────────────────────────────────────────────
 *   • token    → stored in localStorage/SecureStore; attached to every API call
 *   • role     → used for conditional UI rendering (show/hide menu items)
 *   • userId   → used for "my profile" and resource ownership checks
 *   • name     → displayed in the UI header ("Hoş geldiniz, Ahmet")
 */
public class AuthResponse {

    private String token;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String name;
    private String role;
    private String email;
    private LocalDateTime expiresAt;

    public AuthResponse() {}

    /**
     * Builder-style static factory method for clean construction.
     */
    public static AuthResponse of(String token, Long userId, String username,
                                   String name, String role, String email,
                                   long expirationMs) {
        AuthResponse response = new AuthResponse();
        response.token = token;
        response.userId = userId;
        response.username = username;
        response.name = name;
        response.role = role;
        response.email = email;
        response.expiresAt = LocalDateTime.now().plusSeconds(expirationMs / 1000);
        return response;
    }

    // Getters and Setters
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    /**
     * Backward-compatibility alias for clients expecting 'id' instead of 'userId'.
     */
    public Long getId() { return userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
