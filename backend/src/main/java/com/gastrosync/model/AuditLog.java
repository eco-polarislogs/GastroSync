package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Degistirilemez denetim izi (audit trail). Guncelleme / silme uc noktasi yoktur.
 * Mali kayitlarin durum gecisleri, yetki degisiklikleri, giris denemeleri ve
 * yetkisiz erisim girisimleri "kim, ne zaman, ne yapti" seklinde tutulur.
 */
@Entity
@Table(
    name = "audit_logs",
    indexes = {
        @Index(name = "idx_audit_entity", columnList = "entityType, entityId"),
        @Index(name = "idx_audit_timestamp", columnList = "timestamp DESC"),
        @Index(name = "idx_audit_actor", columnList = "actor")
    }
)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false, length = 100)
    private String actor;

    @Column(length = 50)
    private String actorRole;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(length = 40)
    private String entityType;

    private Long entityId;

    @Column(length = 40)
    private String fromStatus;

    @Column(length = 40)
    private String toStatus;

    @Column(length = 2000)
    private String detail;

    @Column(length = 64)
    private String ipAddress;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = LocalDateTime.now();
    }

    public AuditLog() {}

    public AuditLog(String actor, String actorRole, String action, String entityType, Long entityId,
                    String fromStatus, String toStatus, String detail) {
        this.actor = actor;
        this.actorRole = actorRole;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.detail = detail != null && detail.length() > 2000 ? detail.substring(0, 2000) : detail;
        this.timestamp = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getActor() { return actor; }
    public String getActorRole() { return actorRole; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public Long getEntityId() { return entityId; }
    public String getFromStatus() { return fromStatus; }
    public String getToStatus() { return toStatus; }
    public String getDetail() { return detail; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
}
