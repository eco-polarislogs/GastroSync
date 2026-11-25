package com.gastrosync.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Sistem kullanicisi (personel hesabi).
 *
 * Uretim kurallari:
 *  - Sifre yalnizca BCrypt ozeti olarak saklanir ve JSON'a asla yazilmaz.
 *  - Isten ayrilan personel silinmek yerine pasife alinir (denetim izi korunur).
 *  - Sifre degistiginde (passwordChangedAt) eski JWT'ler gecersiz olur.
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_users_username", columnList = "username", unique = true),
        @Index(name = "idx_users_email", columnList = "email"),
        @Index(name = "idx_users_role", columnList = "role"),
        @Index(name = "idx_users_is_deleted", columnList = "is_deleted")
    }
)
@SQLDelete(sql = "UPDATE users SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("is_deleted = false")
public class AppUser extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String role; // ADMIN, MANAGER, CHEF, WAREHOUSE, ACCOUNTANT, FINANCIAL_ADVISOR

    private String email;

    /** null = eski kayit, aktif kabul edilir */
    @Column(name = "is_active")
    private Boolean active = Boolean.TRUE;

    /** Ilk giriste / sifre sifirlamada kullanicinin kendi sifresini belirlemesi zorunludur */
    @Column(name = "must_change_password")
    private Boolean mustChangePassword = Boolean.FALSE;

    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** 'Tum cihazlardan cik' / yonetici oturum sonlandirmasi: bu andan once uretilen token'lar gecersizdir */
    @Column(name = "sessions_revoked_at")
    private LocalDateTime sessionsRevokedAt;

    public AppUser() {}

    public AppUser(String username, String password, String name, String role, String email) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.role = role;
        this.email = email;
        this.active = Boolean.TRUE;
        this.mustChangePassword = Boolean.FALSE;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public boolean isActive() { return active == null || active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isMustChangePassword() { return mustChangePassword != null && mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public LocalDateTime getPasswordChangedAt() { return passwordChangedAt; }
    public void setPasswordChangedAt(LocalDateTime passwordChangedAt) { this.passwordChangedAt = passwordChangedAt; }
    public LocalDateTime getSessionsRevokedAt() { return sessionsRevokedAt; }
    public void setSessionsRevokedAt(LocalDateTime sessionsRevokedAt) { this.sessionsRevokedAt = sessionsRevokedAt; }

    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    /** Kullanici avatari icin bas harfler (orn. "Ahmet Yilmaz" -> "AY") */
    public String getInitials() {
        if (name == null || name.isBlank()) return "GS";
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && Character.isLetter(part.charAt(0))) {
                sb.append(Character.toUpperCase(part.charAt(0)));
            }
            if (sb.length() == 2) break;
        }
        return sb.length() > 0 ? sb.toString() : "GS";
    }
}
