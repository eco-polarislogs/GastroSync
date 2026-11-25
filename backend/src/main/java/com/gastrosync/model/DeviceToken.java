package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Mobil cihazin push bildirim adresi (Expo push token). Bir cihaz ayni anda tek kullaniciya baglidir;
 * cikis, rol degisikligi, pasife alma ve "tum cihazlardan cik" kaydi siler. Hangi bildirimin gidecegi
 * kullanicinin GUNCEL rolune gore sunucuda belirlenir (token'da rol tutulmaz).
 */
@Entity
@Table(name = "device_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_device_token", columnNames = "token"),
        indexes = @Index(name = "idx_device_token_username", columnList = "username"))
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String token;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(length = 20)
    private String platform;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime lastSeenAt;

    public DeviceToken() {}

    public Long getId() { return id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
