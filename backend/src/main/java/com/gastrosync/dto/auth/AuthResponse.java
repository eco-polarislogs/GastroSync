package com.gastrosync.dto.auth;

import java.time.LocalDateTime;

public class AuthResponse {

    private String token;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String name;
    private String role;
    private String email;
    private LocalDateTime expiresAt;
    private boolean mustChangePassword;
    /** Erisim token'inin kalan suresi (sn). Istemci bitmeden once /api/auth/refresh ile yeniler. */
    private long expiresIn;
    /** Opak yenileme token'i (yalnizca giris / yenileme / sifre degisikligi yanitinda) */
    private String refreshToken;
    private long refreshExpiresIn;

    public AuthResponse() {}

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
        response.expiresIn = expirationMs / 1000;
        return response;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
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
    public long getExpiresIn() { return expiresIn; }
    public void setExpiresIn(long expiresIn) { this.expiresIn = expiresIn; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public long getRefreshExpiresIn() { return refreshExpiresIn; }
    public void setRefreshExpiresIn(long refreshExpiresIn) { this.refreshExpiresIn = refreshExpiresIn; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    /** Rolun izinleri ve menu ekranlari sunucudaki tek yetki tablosundan uretilir (istemci tablo tutmaz) */
    public java.util.List<String> getPermissions() { return com.gastrosync.security.Permissions.permissionsOf(role); }
    public java.util.List<String> getScreens() { return com.gastrosync.security.Permissions.screensOf(role); }
    public String getRoleLabel() {
        return com.gastrosync.security.Permissions.ROLE_LABELS.getOrDefault(
                com.gastrosync.security.AppRoles.normalize(role), role);
    }
}
