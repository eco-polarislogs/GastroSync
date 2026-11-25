package com.gastrosync.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.ChatMessage;
import com.gastrosync.model.ChatReadState;
import com.gastrosync.repository.ChatMessageRepository;
import com.gastrosync.repository.ChatReadStateRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;

/**
 * Departman ici ekip sohbeti.
 *  - Kanal erisimi AppRoles.CHAT_CHANNELS politikasina tabidir (okuma, yazma ve canli yayin).
 *  - Gonderen adi / rolu / avatari istemciden degil oturumdan alinir (kimlik sahteciligi engeli).
 *  - Yalnizca ACIL mesajlar kalici bildirim uretir; bildirim sadece o kanali gorebilen rollere gider.
 */
@Service
@Transactional
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final int MAX_LENGTH = 2000;

    private final ChatMessageRepository chatMessageRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatReadStateRepository readStateRepository;

    public ChatService(ChatMessageRepository chatMessageRepository,
                       NotificationService notificationService,
                       SimpMessagingTemplate messagingTemplate,
                       ChatReadStateRepository readStateRepository) {
        this.readStateRepository = readStateRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.notificationService = notificationService;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> getMessagesFor(AuthenticatedUser user, String channelId) {
        if (channelId == null || channelId.isBlank() || "all".equalsIgnoreCase(channelId)) {
            Set<String> allowed = Set.copyOf(AppRoles.accessibleChannels(user.role()));
            return chatMessageRepository.findAllByOrderByCreatedAtAsc().stream()
                    .filter(m -> m.getChannelId() != null && allowed.contains(m.getChannelId().toLowerCase(Locale.ROOT)))
                    .toList();
        }
        String channel = channelId.trim().toLowerCase(Locale.ROOT);
        if (!AppRoles.canAccessChannel(user.role(), channel)) {
            throw new AccessDeniedException("Bu kanala erisim yetkiniz yok: " + channel);
        }
        return chatMessageRepository.findByChannelIdOrderByCreatedAtAsc(channel);
    }

    public ChatMessage send(AuthenticatedUser user, String channelId, String text, String priority) {
        String channel = channelId == null || channelId.isBlank() ? "general" : channelId.trim().toLowerCase(Locale.ROOT);
        if (!AppRoles.CHAT_CHANNELS.containsKey(channel)) {
            throw new IllegalArgumentException("Gecersiz sohbet kanali: " + channel);
        }
        if (!AppRoles.canAccessChannel(user.role(), channel)) {
            throw new AccessDeniedException("Bu kanala mesaj gonderme yetkiniz yok: " + channel);
        }
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Mesaj metni bos olamaz");
        }
        if (clean.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Mesaj en fazla " + MAX_LENGTH + " karakter olabilir");
        }
        boolean urgent = "urgent".equalsIgnoreCase(priority) || "high".equalsIgnoreCase(priority);

        ChatMessage message = new ChatMessage(channel, user.displayName(), user.role().toLowerCase(Locale.ROOT), clean,
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")), initials(user.displayName()),
                urgent ? "urgent" : "normal");
        message.setSenderUsername(user.username());
        ChatMessage saved = chatMessageRepository.save(message);

        NotificationService.afterCommit(() -> {
            try {
                messagingTemplate.convertAndSend("/topic/chat/" + channel, saved);
            } catch (RuntimeException ex) {
                log.warn("WebSocket sohbet yayini gonderilemedi: {}", ex.getMessage());
            }
        });

        if (urgent) {
            Set<String> roles = AppRoles.CHAT_CHANNELS.get(channel);
            notificationService.notify(roles,
                    "Acil Ekip Mesaji: " + user.displayName() + " (#" + channel + ")",
                    clean.length() > 300 ? clean.substring(0, 300) + "..." : clean,
                    user.displayName(), "CHAT", saved.getId(), null, "CRITICAL");
        }
        return saved;
    }

    /**
     * Kanal bazli okunmamis mesaj sayilari. Kullanici bir kanali ilk kez gordugunde gecmis mesajlar
     * okunmus sayilir (yeni personel yuzlerce eski mesajla karsilasmaz).
     */
    public Map<String, Long> unreadCounts(AuthenticatedUser user) {
        Map<String, ChatReadState> states = new LinkedHashMap<>();
        for (ChatReadState st : readStateRepository.findByUsername(user.username())) states.putIfAbsent(st.getChannelId(), st);
        Map<String, Long> out = new LinkedHashMap<>();
        for (String ch : AppRoles.accessibleChannels(user.role())) {
            ChatReadState st = states.get(ch);
            if (st == null) {
                Long max = chatMessageRepository.maxIdByChannel(ch);
                st = readStateRepository.save(new ChatReadState(user.username(), ch, max));
            }
            out.put(ch, chatMessageRepository.countUnread(ch, st.getLastReadMessageId(), user.username(), user.displayName()));
        }
        return out;
    }

    /** Kanali okundu isaretler; kullanicinin diger cihazlarina (web / mobil) anlik iletilir */
    public Map<String, Object> markRead(AuthenticatedUser user, String channelId, Long upTo) {
        String ch = channelId == null ? "" : channelId.trim().toLowerCase(Locale.ROOT);
        if (!AppRoles.canAccessChannel(user.role(), ch)) {
            throw new AccessDeniedException("Bu kanala erisim yetkiniz yok: " + ch);
        }
        Long max = chatMessageRepository.maxIdByChannel(ch);
        long target = max == null ? 0L : max;
        if (upTo != null && upTo > 0 && upTo < target) target = upTo;
        ChatReadState st = readStateRepository.findByUsernameAndChannelId(user.username(), ch)
                .orElseGet(() -> new ChatReadState(user.username(), ch, 0L));
        if (st.getId() == null || target > st.getLastReadMessageId()) {
            st.setLastReadMessageId(Math.max(target, st.getLastReadMessageId()));
            st.setUpdatedAt(LocalDateTime.now());
            st = readStateRepository.save(st);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("channelId", ch);
        payload.put("lastReadMessageId", st.getLastReadMessageId());
        payload.put("unread", chatMessageRepository.countUnread(ch, st.getLastReadMessageId(), user.username(), user.displayName()));
        String username = user.username();
        NotificationService.afterCommit(() -> {
            try {
                messagingTemplate.convertAndSendToUser(username, "/queue/chat-read", payload);
            } catch (RuntimeException ex) {
                log.warn("Sohbet okundu bilgisi iletilemedi: {}", ex.getMessage());
            }
        });
        return payload;
    }

    /** Sistem tarafindan uretilen otomatik kanal mesaji (orn. tedarik talebi) */
    public void postSystemMessage(String channel, String senderName, String senderRole, String text) {
        try {
            ChatMessage saved = chatMessageRepository.save(new ChatMessage(channel, senderName,
                    senderRole.toLowerCase(Locale.ROOT), text,
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")), initials(senderName), "normal"));
            NotificationService.afterCommit(() -> messagingTemplate.convertAndSend("/topic/chat/" + channel, saved));
        } catch (RuntimeException ex) {
            log.warn("Sistem sohbet mesaji yazilamadi: {}", ex.getMessage());
        }
    }

    static String initials(String name) {
        if (name == null || name.isBlank()) return "GS";
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && Character.isLetter(part.charAt(0))) sb.append(Character.toUpperCase(part.charAt(0)));
            if (sb.length() == 2) break;
        }
        return sb.length() > 0 ? sb.toString() : "GS";
    }
}
