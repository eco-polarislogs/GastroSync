package com.gastrosync.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;

/**
 * Yetkisiz erisim girisimlerini (API 403, istemci rota engeli) denetim izine yazar ve
 * yoneticilere (ADMIN, MANAGER) kritik bildirim olarak iletir.
 * Ayni kullanici + kaynak icin 2 dakika icinde tekrar eden olaylar tek bildirime indirgenir.
 */
@Service
public class SecurityAlertService {

    private static final Logger log = LoggerFactory.getLogger(SecurityAlertService.class);
    private static final long DEDUPE_SECONDS = 120;

    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final Map<String, Instant> recent = new ConcurrentHashMap<>();

    public SecurityAlertService(NotificationService notificationService, AuditService auditService,
                                CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reportDeniedRequest(String method, String uri, String source) {
        report(method + " " + uri, "API_ERISIM_REDDI", source);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void report(String resource, String action, String source) {
        String username = currentUserService.username();
        String role = currentUserService.role();
        String name = currentUserService.displayName();
        String safeResource = sanitize(resource, 200);
        String safeAction = sanitize(action, 80);

        log.warn("YETKISIZ ERISIM: kullanici={} rol={} kaynak={} eylem={} kaynak-tipi={}", username, role, safeResource, safeAction, source);

        String key = username + "|" + safeResource;
        Instant now = Instant.now();
        Instant last = recent.get(key);
        if (last != null && now.minusSeconds(DEDUPE_SECONDS).isBefore(last)) {
            return;
        }
        recent.put(key, now);
        if (recent.size() > 5000) recent.clear();

        auditService.log("ACCESS_DENIED", "SECURITY", null, null, null,
                String.format("%s (%s) yetkisiz erisim: %s [%s, %s]", username, role, safeResource, safeAction, source));
        try {
            notificationService.notify(List.of(AppRoles.ADMIN, AppRoles.MANAGER),
                    "Yetkisiz Erisim Engellendi: " + name,
                    String.format("%s (%s) yetkisi olmayan '%s' kaynagina erismeye calisti ve engellendi. Kaynak: %s",
                            name, role, safeResource, source),
                    "Sistem Guvenlik Duvari", "SECURITY_ALERT", null, "/audit", "CRITICAL");
        } catch (RuntimeException ex) {
            log.error("Guvenlik bildirimi olusturulamadi", ex);
        }
    }

    private static String sanitize(String value, int max) {
        if (value == null || value.isBlank()) return "-";
        String clean = value.replaceAll("[\\r\\n\\t]", " ").trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }
}
