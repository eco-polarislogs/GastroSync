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
 * Yenileme (refresh) token'i: sunucuda yalnizca SHA-256 ozeti saklanir.
 *
 * Her kullanimda dondurulur (rotation): eski token iptal edilir, ayni aileden (familyId = bir cihaz oturumu)
 * yenisi verilir. Iptal edilmis bir token tekrar kullanilirsa (calinti suphesi) tum aile iptal edilir.
 * Aile en fazla gastrosync.jwt.session-max-days gun yasar (mutlak oturum suresi).
 */
@Entity
@Table(name = "refresh_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_refresh_token_hash", columnNames = "tokenHash"),
        indexes = {
                @Index(name = "idx_refresh_username", columnList = "username"),
                @Index(name = "idx_refresh_family", columnList = "familyId")
        })
public class RefreshToken {

    public static final String ROTATED = "ROTATED";
    public static final String LOGOUT = "LOGOUT";
    public static final String REUSE_DETECTED = "REUSE_DETECTED";
    public static final String SESSIONS_REVOKED = "SESSIONS_REVOKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String tokenHash;

    @Column(nullable = false, length = 100)
    private String username;

    private Long userId;

    @Column(nullable = false, length = 36)
    private String familyId;

    /** Ailenin (cihaz oturumunun) ilk girisi */
    @Column(nullable = false)
    private LocalDateTime familyStartedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime revokedAt;

    @Column(length = 30)
    private String revokeReason;

    @Column(length = 120)
    private String device;

    @Column(length = 64)
    private String ip;

    public RefreshToken() {}

    public boolean isRevoked() { return revokedAt != null; }

    public Long getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getFamilyId() { return familyId; }
    public void setFamilyId(String familyId) { this.familyId = familyId; }
    public LocalDateTime getFamilyStartedAt() { return familyStartedAt; }
    public void setFamilyStartedAt(LocalDateTime familyStartedAt) { this.familyStartedAt = familyStartedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
    public String getRevokeReason() { return revokeReason; }
    public void setRevokeReason(String revokeReason) { this.revokeReason = revokeReason; }
    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
}
