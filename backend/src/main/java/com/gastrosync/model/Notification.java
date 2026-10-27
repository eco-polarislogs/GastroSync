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

    private String type; // EXPENSE_APPROVAL, EXPENSE_REJECTED, CASH_ALLOCATED, DEBT_ALERT, GENERAL, SECURITY_ALERT, CHAT

    private Long relatedEntityId; // İlgili gider, fatura veya sipariş ID'si

    private String actionType; // Örn: EXPENSE_DETAIL, INVENTORY_RESTOCK, SECURITY_LOG, CHAT_OPEN

    private String route; // Deep linking rota yönlendirmesi: /advisor-ledger, /cashier, /inventory, /users

    private String severity = "INFO"; // CRITICAL, WARNING, INFO

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
        if (this.severity == null) {
            this.severity = "INFO";
        }
    }

    public Notification() {
        this.createdAt = LocalDateTime.now();
        this.severity = "INFO";
        this.isRead = false;
    }

    public Notification(String title, String message, String targetRole, String senderName, String type, Long relatedEntityId) {
        this.title = title;
        this.message = message;
        this.targetRole = targetRole;
        this.senderName = senderName;
        this.type = type;
        this.relatedEntityId = relatedEntityId;
        this.isRead = false;
        this.severity = "SECURITY_ALERT".equalsIgnoreCase(type) ? "CRITICAL" : "INFO";
        this.createdAt = LocalDateTime.now();
    }

    public Notification(String title, String message, String targetRole, String senderName, String type, Long relatedEntityId, String actionType, String route, String severity) {
        this.title = title;
        this.message = message;
        this.targetRole = targetRole;
        this.senderName = senderName;
        this.type = type;
        this.relatedEntityId = relatedEntityId;
        this.actionType = actionType;
        this.route = route;
        this.severity = severity != null ? severity : "INFO";
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

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
