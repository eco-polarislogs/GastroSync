package com.gastrosync.service;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.gastrosync.dto.NotificationDto;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.Notification;
import com.gastrosync.model.NotificationRead;
import com.gastrosync.repository.NotificationReadRepository;
import com.gastrosync.repository.NotificationRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;

/**
 * Rol hedefli, kalici ve canli (STOMP) bildirim servisi.
 *
 *  - targetRole: "ALL" | "ACCOUNTANT" | "ACCOUNTANT,MANAGER" (coklu hedef)
 *  - ADMIN ve MANAGER tum bildirimleri gorur (denetim rolleri)
 *  - Okundu bilgisi KULLANICI bazlidir (notification_reads)
 *  - WebSocket yayini islem (commit) tamamlandiktan sonra yapilir; geri alinan
 *    islemler icin hayali bildirim gonderilmez.
 */
@Service
@Transactional
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationReadRepository readRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.gastrosync.service.push.PushService pushService;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationReadRepository readRepository,
                               SimpMessagingTemplate messagingTemplate,
                               com.gastrosync.service.push.PushService pushService) {
        this.notificationRepository = notificationRepository;
        this.readRepository = readRepository;
        this.messagingTemplate = messagingTemplate;
        this.pushService = pushService;
    }

    // ── Okuma ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Notification> getAllNotifications() {
        return notificationRepository.findAllByOrderByCreatedAtDesc();
    }

    /** Geriye donuk uyumluluk: role gore gorunen bildirimler */
    @Transactional(readOnly = true)
    public List<Notification> getNotificationsForRole(String role) {
        String r = AppRoles.normalize(role);
        if (r == null || r.isBlank() || "ALL".equals(r) || AppRoles.SUPERVISORS.contains(r)) {
            return notificationRepository.findTop200ByOrderByCreatedAtDesc();
        }
        return notificationRepository.findVisibleForRole(r);
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> getForUser(AuthenticatedUser user, String requestedRole) {
        String scopeRole = user.role();
        if (user.role() != null && AppRoles.SUPERVISORS.contains(user.role()) && requestedRole != null && !requestedRole.isBlank()
                && !"ALL".equalsIgnoreCase(requestedRole) && AppRoles.isValid(requestedRole)) {
            scopeRole = AppRoles.normalize(requestedRole);
        }
        List<Notification> list = getNotificationsForRole(scopeRole);
        if (list.size() > 200) list = list.subList(0, 200);
        Set<Long> readIds = list.isEmpty()
                ? Set.of()
                : new HashSet<>(readRepository.findReadIds(user.username(), list.stream().map(Notification::getId).toList()));
        return list.stream().map(n -> NotificationDto.of(n, readIds.contains(n.getId()))).toList();
    }

    public static boolean isVisibleTo(Notification n, String role) {
        String r = AppRoles.normalize(role);
        if (r == null) return false;
        if (AppRoles.SUPERVISORS.contains(r)) return true;
        return targetsOf(n.getTargetRole()).stream().anyMatch(t -> "ALL".equals(t) || t.equals(r));
    }

    private static Set<String> targetsOf(String targetRole) {
        if (targetRole == null || targetRole.isBlank()) return Set.of("ALL");
        return Arrays.stream(targetRole.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(java.util.Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    // ── Olusturma ───────────────────────────────────────────────

    /** Sistem/is akisi bildirimi olusturur */
    public Notification notify(Collection<String> targetRoles, String title, String message, String senderName,
                               String type, Long relatedEntityId, String route, String severity) {
        String target = (targetRoles == null || targetRoles.isEmpty())
                ? "ALL"
                : targetRoles.stream().map(AppRoles::normalize).distinct().collect(Collectors.joining(","));
        Notification n = new Notification(title, message, target, senderName, type, relatedEntityId,
                actionFor(type), route, severity != null ? severity : "INFO");
        return createNotification(n);
    }

    public Notification createNotification(Notification notification) {
        if (notification.getTitle() == null || notification.getTitle().isBlank()) {
            throw new IllegalArgumentException("Bildirim basligi zorunludur");
        }
        if (notification.getMessage() == null) notification.setMessage("");
        if (notification.getMessage().length() > 1000) {
            notification.setMessage(notification.getMessage().substring(0, 1000));
        }
        String target = notification.getTargetRole() == null || notification.getTargetRole().isBlank()
                ? "ALL" : String.join(",", targetsOf(notification.getTargetRole()));
        notification.setTargetRole(target);
        if (notification.getRoute() == null || notification.getRoute().isBlank()) {
            notification.setRoute(defaultRouteFor(notification.getType()));
        }
        if (notification.getActionType() == null) {
            notification.setActionType(actionFor(notification.getType()));
        }
        if ("SECURITY_ALERT".equalsIgnoreCase(notification.getType())) {
            notification.setSeverity("CRITICAL");
        }
        notification.setIsRead(false);
        Notification saved = notificationRepository.save(notification);
        afterCommit(() -> {
            broadcast(saved);
            // Uygulama icindeki bildirim merkeziyle ayni bildirim, hedef rollerin telefonlarina da gider
            pushService.dispatch(saved);
        });
        return saved;
    }

    private void broadcast(Notification saved) {
        try {
            NotificationDto dto = NotificationDto.of(saved, false);
            Set<String> targets = targetsOf(saved.getTargetRole());
            if (targets.contains("ALL")) {
                messagingTemplate.convertAndSend("/topic/notifications", dto);
            } else {
                for (String role : targets) {
                    messagingTemplate.convertAndSend("/topic/notifications/" + role, dto);
                }
                messagingTemplate.convertAndSend("/topic/notifications/supervisors", dto);
            }
        } catch (RuntimeException ex) {
            log.warn("WebSocket bildirim yayini gonderilemedi: {}", ex.getMessage());
        }
    }

    public static String defaultRouteFor(String type) {
        if (type == null) return null;
        return switch (type.toUpperCase(java.util.Locale.ROOT)) {
            case "EXPENSE_APPROVAL", "EXPENSE_FINALIZED", "LEDGER", "PERIOD" -> "/advisor-ledger";
            case "EXPENSE_REJECTED", "EXPENSE_PENDING", "EXPENSE_PAYMENT", "CASH_ALLOCATED", "DEBT_ALERT", "CASH_CLOSING" -> "/cashier";
            case "INVENTORY_LOW", "PURCHASE_REQUEST" -> "/inventory";
            case "PROCUREMENT_PAID" -> "/warehouse";
            case "SECURITY_ALERT" -> "/audit";
            case "SALE_VOID" -> "/sales";
            case "CHAT" -> null;
            default -> null;
        };
    }

    private static String actionFor(String type) {
        if (type == null) return "GENERAL";
        return switch (type.toUpperCase(java.util.Locale.ROOT)) {
            case "EXPENSE_APPROVAL", "EXPENSE_FINALIZED", "EXPENSE_PENDING", "EXPENSE_REJECTED", "EXPENSE_PAYMENT" -> "EXPENSE_DETAIL";
            case "INVENTORY_LOW", "PURCHASE_REQUEST" -> "INVENTORY_RESTOCK";
            case "SECURITY_ALERT" -> "SECURITY_AUDIT";
            case "CHAT" -> "CHAT_OPEN";
            default -> "GENERAL";
        };
    }

    // ── Okundu ──────────────────────────────────────────────────

    public NotificationDto markAsRead(Long id, AuthenticatedUser user) {
        Notification n = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bildirim bulunamadi"));
        if (!isVisibleTo(n, user.role())) {
            // Baskasina ait bildirimin varligini sizdirmamak icin 404
            throw new ResourceNotFoundException("Bildirim bulunamadi");
        }
        if (!readRepository.existsByNotificationIdAndUsername(id, user.username())) {
            readRepository.save(new NotificationRead(id, user.username()));
        }
        afterCommit(() -> sendToUser(user.username(), Map.of("type", "READ", "id", id)));
        return NotificationDto.of(n, true);
    }

    public int markAllAsRead(AuthenticatedUser user) {
        List<Notification> visible = getNotificationsForRole(user.role());
        if (visible.isEmpty()) return 0;
        Set<Long> already = new HashSet<>(readRepository.findReadIds(user.username(),
                visible.stream().map(Notification::getId).toList()));
        int count = 0;
        for (Notification n : visible) {
            if (!already.contains(n.getId())) {
                readRepository.save(new NotificationRead(n.getId(), user.username()));
                count++;
            }
        }
        afterCommit(() -> sendToUser(user.username(), Map.of("type", "READ_ALL")));
        return count;
    }

    private void sendToUser(String username, Object payload) {
        try {
            messagingTemplate.convertAndSendToUser(username, "/queue/notifications", payload);
        } catch (RuntimeException ex) {
            log.debug("Kullaniciya ozel yayin gonderilemedi: {}", ex.getMessage());
        }
    }

    /** Kullaniciya ozel kuyruk (cihazlar arasi senkronizasyon) */
    public void publishToUser(String username, Object payload) {
        afterCommit(() -> sendToUser(username, payload));
    }

    /** Genel konu yayini (stok / finans degisiklik sinyalleri) */
    public void publish(String destination, Object payload) {
        afterCommit(() -> {
            try {
                messagingTemplate.convertAndSend(destination, payload);
            } catch (RuntimeException ex) {
                log.debug("Yayin gonderilemedi {}: {}", destination, ex.getMessage());
            }
        });
    }

    public static void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }
}
