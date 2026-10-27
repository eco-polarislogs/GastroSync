package com.gastrosync.dto.user;

import java.time.LocalDateTime;

/**
 * Response DTO for user data — NEVER exposes the password field.
 *
 * WHY this DTO exists:
 * ────────────────────
 * The AppUser entity contains a 'password' field (BCrypt hash). If we return
 * the entity directly from the API, the hash is serialized into the JSON response.
 * Even though BCrypt is hard to reverse, exposing hashes is a security anti-pattern
 * flagged by OWASP (Sensitive Data Exposure).
 *
 * This DTO acts as a VIEW — it projects only the fields the frontend needs,
 * nothing more. This is the PROJECTION PATTERN from DDD.
 */
public class UserResponse {

    private Long id;
    private String username;
    private String name;
    private String role;
    private String email;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserResponse() {}

    /**
     * Static factory method to convert an entity to a response DTO.
     * This is a manual mapper — in Phase 2 we will replace this with MapStruct.
     */
    public static UserResponse fromEntity(com.gastrosync.model.AppUser user) {
        UserResponse dto = new UserResponse();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.name = user.getName();
        dto.role = user.getRole();
        dto.email = user.getEmail();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
