package com.gastrosync.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.gastrosync.model.ChatMessage;
import com.gastrosync.model.Notification;
import com.gastrosync.repository.ChatMessageRepository;

@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ChatMessageRepository chatMessageRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatService(ChatMessageRepository chatMessageRepository,
                       NotificationService notificationService,
                       SimpMessagingTemplate messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.notificationService = notificationService;
        this.messagingTemplate = messagingTemplate;
        initDefaultChatMessagesIfEmpty();
    }

    private void initDefaultChatMessagesIfEmpty() {
        if (chatMessageRepository.count() == 0) {
            chatMessageRepository.save(new ChatMessage(
                "kitchen", "Mehmet Şef", "chef",
                "Depoda pancar son 2 kg kaldı! Akşamki kış menüsü ve pancarlı meze servisi için acil 15 kg takviye gerekiyor.",
                "10:15", "MŞ", "urgent"
            ));
            chatMessageRepository.save(new ChatMessage(
                "cashier", "Canan Kasa", "accountant",
                "Şefin pancar talebi üzerine toptancıya 1.500 TL nakit kasa çıkışı yapıldı ve fiilen ödendi. Onay masasına iletildi.",
                "10:45", "CK", "normal"
            ));
            chatMessageRepository.save(new ChatMessage(
                "kitchen", "Ali Depocu", "warehouse",
                "Halden 15 kg taze pancar geldi, tartıp mal kabul terminalinden barkodla stoğa işledim şefim.",
                "11:30", "AD", "normal"
            ));
            chatMessageRepository.save(new ChatMessage(
                "cashier", "SMMM Selim", "financial_advisor",
                "Pancar alım faturası ile elektrik faturası dekontunu inceledim ve resmi yevmiye defterine onayladım.",
                "12:00", "SS", "normal"
            ));
            chatMessageRepository.save(new ChatMessage(
                "shift", "Zeynep Müdür", "manager",
                "Akşam 20:00 için 8 kişilik VIP rezervasyon var (Masa 4-5 birleştirilecek). Tatlı porsiyonları kontrol edilsin.",
                "09:00", "ZM", "urgent"
            ));
        }
    }

    public List<ChatMessage> getAllMessages() {
        return chatMessageRepository.findAllByOrderByCreatedAtAsc();
    }

    public List<ChatMessage> getMessagesByChannel(String channelId) {
        if (channelId == null || channelId.isBlank() || channelId.equalsIgnoreCase("all")) {
            return getAllMessages();
        }
        return chatMessageRepository.findByChannelIdOrderByCreatedAtAsc(channelId);
    }

    public ChatMessage sendMessage(ChatMessage message) {
        if (message.getCreatedAt() == null) {
            message.setCreatedAt(LocalDateTime.now());
        }
        if (message.getTime() == null || message.getTime().isBlank()) {
            message.setTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        }
        if (message.getPriority() == null || message.getPriority().isBlank()) {
            message.setPriority("normal");
        }

        ChatMessage saved = chatMessageRepository.save(message);

        // Real-Time STOMP Broadcast: Kanala abone olan tüm cihazlara (Web & Mobil) anında ilet
        try {
            messagingTemplate.convertAndSend("/topic/chat/" + saved.getChannelId().toLowerCase(), saved);
            messagingTemplate.convertAndSend("/topic/chat/all", saved);
        } catch (Exception ex) {
            log.warn("WebSocket sohbet yayını gönderilemedi: {}", ex.getMessage());
        }

        // Sohbet gönderildiğinde otomatik olarak bildirim üret ve tüm ilgili rollere düşür
        try {
            boolean isUrgent = "urgent".equalsIgnoreCase(saved.getPriority());
            String channelTitle = switch (saved.getChannelId().toLowerCase()) {
                case "kitchen" -> "Mutfak & Üretim";
                case "cashier" -> "Kasa & Finans";
                case "shift" -> "Vardiya & Genel";
                default -> "Genel Sohbet";
            };

            String notifTitle = isUrgent
                ? "🚨 ACİL SOHBET: " + saved.getSender() + " (" + channelTitle + ")"
                : "💬 Ekip Sohbeti: " + saved.getSender() + " (" + channelTitle + ")";

            Notification notif = new Notification(
                notifTitle,
                saved.getText(),
                "ALL", // Tüm ekip ve cihazlar görsün
                saved.getSender(),
                "CHAT",
                saved.getId(),
                "CHAT_OPEN",
                "/chat",
                isUrgent ? "CRITICAL" : "INFO"
            );
            notificationService.createNotification(notif);
        } catch (Exception ignored) {
            // Bildirim üretimi ana mesaj akışını kesmesin
        }

        return saved;
    }
}
