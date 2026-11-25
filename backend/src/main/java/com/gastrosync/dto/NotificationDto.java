package com.gastrosync.dto;

import java.time.LocalDateTime;

import com.gastrosync.model.Notification;

/**
 * Kullaniciya ozel bildirim gorunumu: isRead, istegi yapan kullanicinin kendi okuma durumudur.
 */
public record NotificationDto(
        Long id,
        String title,
        String message,
        String targetRole,
        String senderName,
        String type,
        Long relatedEntityId,
        String actionType,
        String route,
        String severity,
        Boolean isRead,
        LocalDateTime createdAt) {

    public static NotificationDto of(Notification n, boolean read) {
        return new NotificationDto(n.getId(), n.getTitle(), n.getMessage(), n.getTargetRole(), n.getSenderName(),
                n.getType(), n.getRelatedEntityId(), n.getActionType(), n.getRoute(), n.getSeverity(), read,
                n.getCreatedAt());
    }
}
