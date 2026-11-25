package com.gastrosync.config;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/**
 * Açık WebSocket oturumlarını kullanıcıya göre izler.
 * Rol değişikliği, hesabın pasife alınması, şifre sıfırlama veya silme durumunda kullanıcının
 * canlı bağlantıları kapatılır; istemci yeniden bağlanırken güncel yetkiyle (veya hiç) bağlanır.
 * Böylece eski rolün kanal aboneliği açık kalmaz.
 */
@Component
public class WebSocketSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSessionRegistry.class);

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionsByUser = new ConcurrentHashMap<>();

    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.put(session.getId(), session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                sessions.remove(session.getId());
                sessionsByUser.values().forEach(ids -> ids.remove(session.getId()));
                super.afterConnectionClosed(session, closeStatus);
            }
        };
    }

    /** STOMP CONNECT doğrulandığında oturumu kullanıcıya bağlar */
    public void bind(String sessionId, String username) {
        if (sessionId == null || username == null) return;
        sessionsByUser.computeIfAbsent(username.toLowerCase(), k -> ConcurrentHashMap.newKeySet()).add(sessionId);
    }

    public void closeUserSessions(String username) {
        if (username == null) return;
        Set<String> ids = sessionsByUser.remove(username.toLowerCase());
        if (ids == null) return;
        for (String id : ids) {
            WebSocketSession s = sessions.get(id);
            if (s != null && s.isOpen()) {
                try {
                    s.close(CloseStatus.POLICY_VIOLATION.withReason("Yetki degisti"));
                } catch (Exception e) {
                    log.debug("WebSocket oturumu kapatilamadi: {}", e.getMessage());
                }
            }
        }
    }
}
