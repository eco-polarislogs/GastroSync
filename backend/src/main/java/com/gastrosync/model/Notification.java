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

@Entity
@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notifications_role_read", columnList = "targetRole, isRead"),
        @Index(name = "idx_notifications_created_at", columnList = "createdAt DESC")
    }
)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title; // Örn: "Mali Müşavir Defter Onayı Bekliyor"

    @Column(nullable = false, length = 1000)
    private String message; // Örn: "Ahmet Kasa tarafından 14:32'de 'Merkez Kira Bedeli (45.000 ₺)' defter onayına gönderildi."

    @Column(nullable = false)
    private String targetRole; // ALL, FINANCIAL_ADVISOR, ACCOUNTANT, ADMIN, MANAGER, CHEF, WAREHOUSE

    private String senderName; // Örn: "Ahmet Yılmaz (Kasa / Muhasebe)"

    private String type; // EXPENSE_APPROVAL, EXPENSE_REJECTED, CASH_ALLOCATED, DEBT_ALERT, GENERAL

    private Long relatedEntityId; // İlgili gider veya sipariş ID'si

    private Boolean isRead = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.isRead == null) {
            this.isRead = false;
        }
    }

    public Notification() {
        this.createdAt = LocalDateTime.now();
    }

    public Notification(String title, String message, String targetRole, String senderName, String type, Long relatedEntityId) {
        this.title = title;
        this.message = message;
        this.targetRole = targetRole;
        this.senderName = senderName;
        this.type = type;
        this.relatedEntityId = relatedEntityId;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getTargetRole() { return targetRole; }
    public void setTargetRole(String targetRole) { this.targetRole = targetRole; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Long getRelatedEntityId() { return relatedEntityId; }
    public void setRelatedEntityId(Long relatedEntityId) { this.relatedEntityId = relatedEntityId; }

    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
