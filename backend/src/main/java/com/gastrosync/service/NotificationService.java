package com.gastrosync.service;

import com.gastrosync.model.Notification;
import com.gastrosync.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
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
                4L
            ));

            notificationRepository.save(new Notification(
                "💵 Günlük Kasa Dağıtımı Yapıldı",
                "Kasaya giren 5.000 ₺ tutar; Elektrik Avansı, Sarf Malzeme ve Soğuk Zincir Lojistik giderlerine paylaştırıldı.",
                "FINANCIAL_ADVISOR",
                "Canan Kasa (Muhasebe)",
                "CASH_ALLOCATED",
                null
            ));

            notificationRepository.save(new Notification(
                "❌ Gider Onayı Reddedildi (Gerekçeli)",
                "Selahattin Müşavir tarafından 'Instagram & Yerel Yemek Rehberi Reklamı (5.000 ₺)' faturası stopaj/tevkifat gerekçesiyle reddedildi. Düzeltme bekleniyor.",
                "ACCOUNTANT",
                "Selahattin Müşavir (Mali Müşavir)",
                "EXPENSE_REJECTED",
                13L
            ));

            notificationRepository.save(new Notification(
                "⏳ Yaklaşan Kira Vadesi Hatırlatması",
                "Merkez Restoran Kirası (45.000 ₺) için son ödeme vadesi yaklaşıyor. Kasa bakiyesi yeterli.",
                "ALL",
                "Sistem Finans Botu",
                "DEBT_ALERT",
                1L
            ));
        }
    }

    public List<Notification> getAllNotifications() {
        return notificationRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Notification> getNotificationsForRole(String role) {
        if (role == null || role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("MANAGER")) {
            return notificationRepository.findAllByOrderByCreatedAtDesc();
        }
        return notificationRepository.findByTargetRoleInOrderByCreatedAtDesc(Arrays.asList("ALL", role.toUpperCase()));
    }

    public Notification createNotification(Notification notification) {
        return notificationRepository.save(notification);
    }

    public Notification markAsRead(Long id) {
        return notificationRepository.findById(id).map(n -> {
            n.setIsRead(true);
            return notificationRepository.save(n);
        }).orElse(null);
    }

    public void markAllAsReadForRole(String role) {
        List<Notification> list = getNotificationsForRole(role);
        for (Notification n : list) {
            n.setIsRead(true);
        }
        notificationRepository.saveAll(list);
    }
}
