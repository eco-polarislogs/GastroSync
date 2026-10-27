package com.gastrosync.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.Notification;
import com.gastrosync.service.NotificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Bildirimler & Rol İletişimi", description = "Rol tabanlı onay, ret, kasa ve yevmiye bildirimleri")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Tüm bildirimleri veya role göre bildirimleri getir")
    public ResponseEntity<ApiResponse<List<Notification>>> getNotifications(@RequestParam(name = "role", required = false) String role) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isElevated = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"));

        String effectiveRole;
        if (isElevated) {
            // Admin and Manager can filter by specific role or view all
            effectiveRole = (role != null && !role.isBlank()) ? role : null;
        } else {
            // Strict IDOR Prevention: non-admin users can ONLY fetch notifications for their own authenticated role!
            effectiveRole = auth.getAuthorities().stream()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .findFirst()
                    .orElse("ALL");
        }

        List<Notification> list = (effectiveRole != null && !effectiveRole.isBlank())
                ? notificationService.getNotificationsForRole(effectiveRole)
                : notificationService.getAllNotifications();
        return ResponseEntity.ok(ApiResponse.ok("Bildirimler başarıyla getirildi", list));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'ACCOUNTANT', 'FINANCIAL_ADVISOR', 'CHEF', 'WAREHOUSE')")
    @Operation(summary = "Yeni bildirim oluştur")
    public ResponseEntity<ApiResponse<Notification>> createNotification(@RequestBody Notification notification) {
        Notification created = notificationService.createNotification(notification);
        return ResponseEntity.ok(ApiResponse.ok("Bildirim başarıyla kaydedildi", created));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Bildirimi okundu olarak işaretle")
    public ResponseEntity<ApiResponse<Notification>> markAsRead(@PathVariable("id") Long id) {
        Notification updated = notificationService.markAsRead(id);
        if (updated != null) {
            return ResponseEntity.ok(ApiResponse.ok("Bildirim okundu olarak işaretlendi", updated));
        }
        return ResponseEntity.status(404).body(ApiResponse.error("Bildirim bulunamadı"));
    }

    @PutMapping("/mark-all-read")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Belirli bir role ait tüm bildirimleri okundu yap")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(@RequestParam(name = "role", required = false) String role) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean isElevated = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"));

        String targetRole;
        if (isElevated) {
            targetRole = (role != null && !role.isBlank()) ? role : "ALL";
        } else {
            targetRole = auth.getAuthorities().stream()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .findFirst()
                    .orElse("ALL");
        }

        notificationService.markAllAsReadForRole(targetRole);
        return ResponseEntity.ok(ApiResponse.ok("Tüm bildirimler okundu olarak işaretlendi", null));
    }
}
