package com.gastrosync.dto.user;

import java.time.LocalDateTime;

import com.gastrosync.model.AppUser;

public class UserResponse {

    private Long id;
    private String username;
    private String name;
    private String role;
    private String email;
    private boolean active;
    private boolean mustChangePassword;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserResponse() {}

    public static UserResponse fromEntity(AppUser user) {
        UserResponse dto = new UserResponse();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.name = user.getName();
        dto.role = com.gastrosync.security.AppRoles.normalize(user.getRole());
        dto.email = user.getEmail();
        dto.active = user.isActive();
        dto.mustChangePassword = user.isMustChangePassword();
        dto.lastLoginAt = user.getLastLoginAt();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }

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
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /** Rolun izinleri ve menu ekranlari sunucudaki tek yetki tablosundan uretilir (istemci tablo tutmaz) */
    public java.util.List<String> getPermissions() { return com.gastrosync.security.Permissions.permissionsOf(role); }
    public java.util.List<String> getScreens() { return com.gastrosync.security.Permissions.screensOf(role); }
    public String getRoleLabel() {
        return com.gastrosync.security.Permissions.ROLE_LABELS.getOrDefault(
                com.gastrosync.security.AppRoles.normalize(role), role);
    }
}
