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
 * Kullanici bazli "okundu" bilgisi. Bir bildirimi bir kisinin okumasi,
 * ayni bildirimi alan diger personel icin okunmus sayilmaz.
 */
@Entity
@Table(
    name = "notification_reads",
    uniqueConstraints = @UniqueConstraint(name = "uk_notification_read_user", columnNames = {"notificationId", "username"}),
    indexes = @Index(name = "idx_notification_reads_user", columnList = "username")
)
public class NotificationRead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long notificationId;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(nullable = false)
    private LocalDateTime readAt;

    public NotificationRead() {}

    public NotificationRead(Long notificationId, String username) {
        this.notificationId = notificationId;
        this.username = username;
        this.readAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getNotificationId() { return notificationId; }
    public String getUsername() { return username; }
    public LocalDateTime getReadAt() { return readAt; }
}
