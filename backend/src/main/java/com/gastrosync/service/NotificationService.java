package com.gastrosync.service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.Notification;
import com.gastrosync.repository.NotificationRepository;

@Service
@Transactional
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(NotificationRepository notificationRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
        initDefaultNotificationsIfEmpty();
    }

    private void initDefaultNotificationsIfEmpty() {
        if (notificationRepository.count() == 0) {
            notificationRepository.save(new Notification(
                "🚀 Yeni Gider Defter Onayı Bekliyor",
                "Canan Kasa tarafından 'Sanayi Tipi Mutfak Elektrik Faturası (14.200 ₺)' ödendi ve Mali Müşavir resmi defter onayına iletildi.",
                "FINANCIAL_ADVISOR",
                "Canan Kasa (Muhasebe)",
                "EXPENSE_APPROVAL",
                4L,
                "EXPENSE_DETAIL",
                "/advisor-ledger",
                "WARNING"
            ));

            notificationRepository.save(new Notification(
                "💵 Günlük Kasa Dağıtımı Yapıldı",
                "Kasaya giren 5.000 ₺ tutar; Elektrik Avansı, Sarf Malzeme ve Soğuk Zincir Lojistik giderlerine paylaştırıldı.",
                "FINANCIAL_ADVISOR",
                "Canan Kasa (Muhasebe)",
                "CASH_ALLOCATED",
                null,
                "CASHIER_VIEW",
                "/cashier",
                "INFO"
            ));

            notificationRepository.save(new Notification(
                "❌ Gider Onayı Reddedildi (Gerekçeli)",
                "Selahattin Müşavir tarafından 'Instagram & Yerel Yemek Rehberi Reklamı (5.000 ₺)' faturası stopaj/tevkifat gerekçesiyle reddedildi. Düzeltme bekleniyor.",
                "ACCOUNTANT",
                "Selahattin Müşavir (Mali Müşavir)",
                "EXPENSE_REJECTED",
                13L,
                "EXPENSE_EDIT",
                "/cashier",
                "WARNING"
            ));

            notificationRepository.save(new Notification(
                "⏳ Yaklaşan Kira Vadesi Hatırlatması",
                "Merkez Restoran Kirası (45.000 ₺) için son ödeme vadesi yaklaşıyor. Kasa bakiyesi yeterli.",
                "ALL",
                "Sistem Finans Botu",
                "DEBT_ALERT",
                1L,
                "DEBT_VIEW",
                "/advisor-ledger",
                "WARNING"
            ));
        }
    }

    public List<Notification> getAllNotifications() {
        return notificationRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Notification> getNotificationsForRole(String role) {
        if (role == null || role.isBlank() || role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("MANAGER") || role.equalsIgnoreCase("ALL")) {
            return notificationRepository.findAllByOrderByCreatedAtDesc();
        }
        return notificationRepository.findByTargetRoleInOrderByCreatedAtDesc(Arrays.asList("ALL", role.toUpperCase()));
    }

    public Notification createNotification(Notification notification) {
        // Otomatik akıllı deep-linking rota ataması
        if (notification.getRoute() == null || notification.getRoute().isBlank()) {
            if ("EXPENSE_APPROVAL".equalsIgnoreCase(notification.getType()) || "DEBT_ALERT".equalsIgnoreCase(notification.getType())) {
                notification.setRoute("/advisor-ledger");
                notification.setActionType("EXPENSE_DETAIL");
            } else if ("EXPENSE_REJECTED".equalsIgnoreCase(notification.getType()) || "CASH_ALLOCATED".equalsIgnoreCase(notification.getType())) {
                notification.setRoute("/cashier");
                notification.setActionType("CASHIER_VIEW");
            } else if ("SECURITY_ALERT".equalsIgnoreCase(notification.getType())) {
                notification.setRoute("/users");
                notification.setActionType("SECURITY_AUDIT");
                notification.setSeverity("CRITICAL");
            } else if ("INVENTORY_LOW".equalsIgnoreCase(notification.getType())) {
                notification.setRoute("/inventory");
                notification.setActionType("INVENTORY_RESTOCK");
                notification.setSeverity("WARNING");
            } else if ("CHAT".equalsIgnoreCase(notification.getType())) {
                notification.setRoute("/chat");
                notification.setActionType("CHAT_OPEN");
            }
        }

        Notification saved = notificationRepository.save(notification);

        // Real-Time STOMP Push: Tüm bağlı Web ve Mobil istemcilere sub-millisecond yayın
        try {
            messagingTemplate.convertAndSend("/topic/notifications", saved);
            if (saved.getTargetRole() != null && !saved.getTargetRole().equalsIgnoreCase("ALL")) {
                messagingTemplate.convertAndSend("/topic/notifications/" + saved.getTargetRole().toUpperCase(), saved);
            }
        } catch (Exception ex) {
            log.warn("WebSocket bildirim yayını gönderilemedi: {}", ex.getMessage());
        }

        return saved;
    }

    public Notification markAsRead(Long id) {
        return notificationRepository.findById(id).map(n -> {
            n.setIsRead(true);
            Notification updated = notificationRepository.save(n);
            // Okundu durumu senkronizasyonunu anlık olarak tüm cihazlara yayınla
            try {
                messagingTemplate.convertAndSend("/topic/notifications/read", updated);
            } catch (Exception ex) {
                log.warn("WebSocket okundu yayını gönderilemedi: {}", ex.getMessage());
            }
            return updated;
        }).orElse(null);
    }

    public void markAllAsReadForRole(String role) {
        List<Notification> list = getNotificationsForRole(role);
        for (Notification n : list) {
            n.setIsRead(true);
        }
        notificationRepository.saveAll(list);
        try {
            messagingTemplate.convertAndSend("/topic/notifications/mark-all-read",
                    Map.of("role", role != null ? role.toUpperCase() : "ALL"));
        } catch (Exception ex) {
            log.warn("WebSocket toplu okundu yayını gönderilemedi: {}", ex.getMessage());
        }
    }
}
