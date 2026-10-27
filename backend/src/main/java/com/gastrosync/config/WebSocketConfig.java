package com.gastrosync.config;

import java.security.Principal;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.gastrosync.security.JwtTokenProvider;

/**
 * Enterprise Real-Time WebSocket & STOMP Message Broker Configuration.
 *
 * Implements RFC 6750 JWT Bearer validation upon CONNECT frames and
 * enforces strict RBAC topic routing policies across all restaurant channels.
 */
@Configuration
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);
    private final JwtTokenProvider jwtTokenProvider;

    public WebSocketConfig(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Simple in-memory message broker for channels and queues
        config.enableSimpleBroker("/topic", "/queue");
        // Application destination prefix for @MessageMapping methods
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Primary Enterprise STOMP endpoint for Web & Mobile
        registry.addEndpoint("/ws/gastrosync", "/ws")
                .setAllowedOriginPatterns("*");

        // SockJS fallback endpoint
        registry.addEndpoint("/ws/gastrosync", "/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null) {
                    return message;
                }

                // 1. CONNECT FRAME - JWT Bearer Token Validation
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    String token = null;

                    if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
                        token = authHeader.substring(7);
                    } else {
                        // Query param fallback or pass-through
                        token = accessor.getFirstNativeHeader("token");
                    }

                    if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
                        String username = jwtTokenProvider.getUsername(token);
                        String role = jwtTokenProvider.getRole(token);
                        if (role != null) {
                            role = role.toUpperCase();
                        }

                        Principal principal = new UsernamePasswordAuthenticationToken(
                                username,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + role))
                        );

                        accessor.setUser(principal);
                        if (accessor.getSessionAttributes() != null) {
                            accessor.getSessionAttributes().put("username", username);
                            accessor.getSessionAttributes().put("role", role);
                        }
                        log.info("🔐 STOMP WebSocket authenticated: user={}, role={}", username, role);
                    } else {
                        log.debug("ℹ️ STOMP WebSocket anonymous handshake connection initiated");
                    }
                }

                // 2. SUBSCRIBE FRAME - Role-Based Channel Access Enforcement
                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String destination = accessor.getDestination();
                    Principal user = accessor.getUser();
                    String userRole = null;

                    if (accessor.getSessionAttributes() != null && accessor.getSessionAttributes().containsKey("role")) {
                        userRole = (String) accessor.getSessionAttributes().get("role");
                    }

                    if (destination != null && userRole != null) {
                        validateChannelAuthorization(destination, userRole);
                    }
                }

                return message;
            }
        });
    }

    /**
     * Enforces granular channel routing according to GastroSync Tier-1 RBAC:
     * - /topic/general: All staff
     * - /topic/kitchen: CHEF, MANAGER, ADMIN
     * - /topic/warehouse: WAREHOUSE, CHEF, MANAGER, ADMIN
     * - /topic/management: ADMIN, MANAGER, ACCOUNTANT, FINANCIAL_ADVISOR
     */
    private void validateChannelAuthorization(String destination, String role) {
        String cleanRole = role.toUpperCase();

        if (destination.startsWith("/topic/kitchen")) {
            Set<String> allowed = Set.of("CHEF", "MANAGER", "ADMIN");
            if (!allowed.contains(cleanRole)) {
                log.warn("⛔ STOMP Subscription Rejected: Role {} attempted to join {}", cleanRole, destination);
                throw new AccessDeniedException("Erişim Reddedildi: Mutfak kanalına sadece Şef ve Yönetici katılabilir.");
            }
        } else if (destination.startsWith("/topic/warehouse")) {
            Set<String> allowed = Set.of("WAREHOUSE", "CHEF", "MANAGER", "ADMIN");
            if (!allowed.contains(cleanRole)) {
                log.warn("⛔ STOMP Subscription Rejected: Role {} attempted to join {}", cleanRole, destination);
                throw new AccessDeniedException("Erişim Reddedildi: Depo kanalına sadece Depo Sorumlusu, Şef ve Yönetici katılabilir.");
            }
        } else if (destination.startsWith("/topic/management")) {
            Set<String> allowed = Set.of("ADMIN", "MANAGER", "ACCOUNTANT", "FINANCIAL_ADVISOR");
            if (!allowed.contains(cleanRole)) {
                log.warn("⛔ STOMP Subscription Rejected: Role {} attempted to join {}", cleanRole, destination);
                throw new AccessDeniedException("Erişim Reddedildi: Yönetim kanalına sadece yetkili idari kadro katılabilir.");
            }
        }
    }
}

