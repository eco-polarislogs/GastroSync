package com.gastrosync.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for creating a new user.
 *
 * WHY separate CreateRequest and UpdateRequest DTOs?
 * ──────────────────────────────────────────────────
 * Different operations have different validation requirements:
 *   • Create: username is REQUIRED, password is REQUIRED
 *   • Update: username is IMMUTABLE (can't change), password is OPTIONAL
 *
 * Using a single DTO for both would require nullable fields and complex
 * conditional validation. Separate DTOs follow the INTERFACE SEGREGATION
 * PRINCIPLE (ISP) — each DTO exposes exactly what the operation needs.
 */
public class UserCreateRequest {

    @NotBlank(message = "Kullanıcı adı zorunludur")
    @Size(min = 3, max = 50, message = "Kullanıcı adı 3-50 karakter arasında olmalıdır")
    @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
             message = "Kullanıcı adı sadece harf, rakam, nokta, tire ve alt çizgi içerebilir")
    private String username;

    @NotBlank(message = "Şifre zorunludur")
    @Size(min = 6, max = 100, message = "Şifre en az 6 karakter olmalıdır")
    private String password;

    @NotBlank(message = "Ad soyad zorunludur")
    @Size(min = 2, max = 100, message = "Ad soyad 2-100 karakter arasında olmalıdır")
    private String name;

    @NotBlank(message = "Rol zorunludur")
    @Pattern(regexp = "^(ADMIN|MANAGER|CHEF|WAREHOUSE|ACCOUNTANT|FINANCIAL_ADVISOR)$",
             message = "Geçerli roller: ADMIN, MANAGER, CHEF, WAREHOUSE, ACCOUNTANT, FINANCIAL_ADVISOR")
    private String role;

    @Email(message = "Geçerli bir e-posta adresi giriniz")
    private String email;

    public UserCreateRequest() {}

    // Getters and Setters
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
}
