package com.gastrosync.controller;

import java.util.List;
import java.util.Map;

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
import com.gastrosync.dto.NotificationDto;
import com.gastrosync.model.Notification;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.service.NotificationService;
import com.gastrosync.service.SecurityAlertService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Bildirimler", description = "Rol hedefli bildirimler ve kullanici bazli okundu bilgisi")
public class NotificationController {

    private final NotificationService notificationService;
    private final SecurityAlertService securityAlertService;
    private final CurrentUserService currentUserService;
    private final com.gastrosync.service.push.PushService pushService;

    public NotificationController(NotificationService notificationService, SecurityAlertService securityAlertService,
                                  CurrentUserService currentUserService, com.gastrosync.service.push.PushService pushService) {
        this.notificationService = notificationService;
        this.securityAlertService = securityAlertService;
        this.currentUserService = currentUserService;
        this.pushService = pushService;
    }

    /** Mobil cihazin push adresini (Expo push token) oturum acan kullaniciya baglar */
    @PostMapping("/devices")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> registerDevice(@RequestBody Map<String, String> body) {
        var d = pushService.register(currentUserService.require().username(), body.get("token"), body.get("platform"));
        return ResponseEntity.ok(ApiResponse.ok("Cihaz bildirimlere kaydedildi", Map.of("id", d.getId(), "platform", String.valueOf(d.getPlatform()))));
    }

    /** Cikista cihaz kaydini siler (yalnizca kendi cihazi) */
    @PostMapping("/devices/unregister")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> unregisterDevice(@RequestBody Map<String, String> body) {
        pushService.unregister(currentUserService.require().username(), body.get("token"));
        return ResponseEntity.ok(ApiResponse.ok("Cihaz kaydi silindi", null));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Kullanicinin gorebildigi bildirimler (role parametresi yalnizca ADMIN/MANAGER icin filtredir)")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getNotifications(@RequestParam(name = "role", required = false) String role) {
        return ResponseEntity.ok(ApiResponse.ok("Bildirimler", notificationService.getForUser(currentUserService.require(), role)));
    }

    /** Yonetim duyurusu (yalnizca ADMIN / MANAGER). Is akisi bildirimleri sunucuda otomatik uretilir. */
    @PostMapping
    @PreAuthorize("@perm.can('ANNOUNCE')")
    @Operation(summary = "Yonetim duyurusu olustur")
    public ResponseEntity<ApiResponse<Notification>> createNotification(@RequestBody Map<String, Object> body) {
        AuthenticatedUser me = currentUserService.require();
        String target = body.get("targetRole") != null ? body.get("targetRole").toString() : "ALL";
        for (String t : target.split(",")) {
            if (!"ALL".equalsIgnoreCase(t.trim()) && !AppRoles.isValid(t)) {
                throw new IllegalArgumentException("Gecersiz hedef rol: " + t);
            }
        }
        String severity = body.get("severity") != null ? body.get("severity").toString().toUpperCase() : "INFO";
        if (!List.of("INFO", "WARNING", "CRITICAL").contains(severity)) severity = "INFO";
        Notification n = new Notification(
                String.valueOf(body.getOrDefault("title", "Duyuru")),
                String.valueOf(body.getOrDefault("message", "")),
                target.toUpperCase(), me.displayName(), "ANNOUNCEMENT", null, "GENERAL", null, severity);
        return ResponseEntity.ok(ApiResponse.ok("Duyuru yayinlandi", notificationService.createNotification(n)));
    }

    @PostMapping("/security-alert")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Istemci tarafinda engellenen yetkisiz ekran erisimini bildir")
    public ResponseEntity<ApiResponse<Void>> reportSecurityAlert(@RequestBody(required = false) Map<String, String> payload) {
        String screen = payload != null && payload.get("screen") != null ? payload.get("screen") : "Kisitli Ekran";
        String action = payload != null && payload.get("action") != null ? payload.get("action") : "Yetkisiz Erisim";
        securityAlertService.report("Ekran: " + screen, action, "ISTEMCI");
        return ResponseEntity.ok(ApiResponse.ok("Guvenlik olayi kaydedildi", null));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<NotificationDto>> markAsRead(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Bildirim okundu", notificationService.markAsRead(id, currentUserService.require())));
    }

    @PutMapping("/mark-all-read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markAllAsRead() {
        int count = notificationService.markAllAsRead(currentUserService.require());
        return ResponseEntity.ok(ApiResponse.ok("Tum bildirimler okundu", Map.of("count", count)));
    }
}
