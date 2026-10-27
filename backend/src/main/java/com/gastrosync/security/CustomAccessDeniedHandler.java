package com.gastrosync.security;

import java.io.IOException;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.Notification;
import com.gastrosync.repository.NotificationRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Kurumsal Yetkisiz Erişim (HTTP 403) İşleyicisi.
 *
 * Sisteme kayıtlı bir personelin kendi yetki sınırlarını aşan bir kaynağa
 * (örneğin Chef veya Depocunun Satış Raporuna veya Kullanıcı Yönetimine)
 * erişmeye çalıştığında:
 *   1. Erişimi derhal 403 koduyla durdurur.
 *   2. İlgili olayı denetim günlüğüne yazar.
 *   3. Veritabanına MANAGER ve ADMIN rolleri için kalıcı GÜVENLİK ALARMI (SECURITY_ALERT)
 *      bildirimi kaydederek anında bildirim merkezine düşürür.
 *   4. İstemciye standart JSON formatında hata yanıtı döner.
 */
@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(CustomAccessDeniedHandler.class);

    private final ObjectMapper objectMapper;
    private final NotificationRepository notificationRepository;

    public CustomAccessDeniedHandler(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = (auth != null && auth.isAuthenticated()) ? auth.getName() : "Bilinmeyen Kullanıcı";
        String roles = (auth != null)
                ? auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.joining(","))
                : "YETKİSİZ";

        String method = request.getMethod();
        String uri = request.getRequestURI();

        log.warn("🚨 YETKİSİZ ERİŞİM GİRİŞİMİ ENGELLENDİ: Kullanıcı={} Roller={} İstek={} {}",
                username, roles, method, uri);

        // Yönetici (MANAGER) ve Sistem Yöneticisine (ADMIN) otomatik güvenlik alarmı üret
        try {
            String title = "🚨 Yetkisiz Erişim Engeli: " + username;
            String message = String.format(
                "%s (%s) kullanıcısı yetkisiz olarak '%s %s' kaynağına erişmeye çalıştı ve güvenlik duvarı tarafından engellendi.",
                username, roles.replace("ROLE_", ""), method, uri
            );

            Notification managerAlert = new Notification(
                title,
                message,
                "MANAGER",
                "Sistem Güvenlik Duvarı (RBAC)",
                "SECURITY_ALERT",
                null
            );

            Notification adminAlert = new Notification(
                title,
                message,
                "ADMIN",
                "Sistem Güvenlik Duvarı (RBAC)",
                "SECURITY_ALERT",
                null
            );

            notificationRepository.save(managerAlert);
            notificationRepository.save(adminAlert);
        } catch (Exception ex) {
            log.error("Yetkisiz erişim güvenlik bildirimi kaydedilirken hata:", ex);
        }

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        ApiResponse<Void> errorResponse = ApiResponse.error(
            "Yetkisiz Erişim Engellendi: Bu işlem için gerekli yetkiniz bulunmamaktadır. Olay güvenlik denetim günlüğüne kaydedildi ve yöneticilere bildirildi."
        );

        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
