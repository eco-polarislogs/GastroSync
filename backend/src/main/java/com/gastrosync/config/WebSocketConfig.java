package com.gastrosync.config;

import java.security.Principal;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.SecurityConfig;
import com.gastrosync.security.TokenAuthenticationService;

/**
 * STOMP / WebSocket guvenligi:
 *  1. CONNECT cercevesinde gecerli JWT ZORUNLU (anonim baglanti reddedilir).
 *  2. Her SUBSCRIBE, AppRoles.canSubscribe politikasina gore denetlenir (varsayilan: kapali).
 *  3. SEND yalnizca /app/chat.sendMessage hedefine yapilabilir; gonderen kimligi sunucuda belirlenir.
 */
@Configuration
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final TokenAuthenticationService tokenAuthenticationService;
    private final WebSocketSessionRegistry sessionRegistry;
    private final List<String> allowedOrigins;

    public WebSocketConfig(TokenAuthenticationService tokenAuthenticationService,
                           WebSocketSessionRegistry sessionRegistry,
                           @Value("${gastrosync.cors.allowed-origins:}") String allowedOrigins) {
        this.tokenAuthenticationService = tokenAuthenticationService;
        this.sessionRegistry = sessionRegistry;
        this.allowedOrigins = SecurityConfig.parseOrigins(allowedOrigins);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(sessionRegistry::decorate);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOrigins.toArray(String[]::new);
        registry.addEndpoint("/ws/gastrosync", "/ws").setAllowedOriginPatterns(origins);
        registry.addEndpoint("/ws/sockjs").setAllowedOriginPatterns(origins).withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() == null) {
                    return message;
                }
                StompCommand command = accessor.getCommand();

                if (StompCommand.CONNECT.equals(command)) {
                    authenticateConnect(accessor);
                } else if (StompCommand.SUBSCRIBE.equals(command)) {
                    AuthenticatedUser user = requireUser(accessor);
                    String destination = accessor.getDestination();
                    if (!AppRoles.canSubscribe(user.role(), destination)) {
                        log.warn("STOMP abonelik reddedildi: kullanici={} rol={} hedef={}", user.username(), user.role(), destination);
                        throw new AccessDeniedException("Bu kanala abone olma yetkiniz yok: " + destination);
                    }
                } else if (StompCommand.SEND.equals(command)) {
                    requireUser(accessor);
                    String destination = accessor.getDestination();
                    if (!"/app/chat.sendMessage".equals(destination)) {
                        throw new AccessDeniedException("Bu hedefe mesaj gonderilemez: " + destination);
                    }
                }
                return message;
            }
        });
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        String token = null;
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        } else if (StringUtils.hasText(accessor.getFirstNativeHeader("token"))) {
            token = accessor.getFirstNativeHeader("token");
        }

        var session = tokenAuthenticationService.resolve(token);
        if (session.isEmpty() || session.get().mustChangePassword()) {
            log.debug("STOMP CONNECT reddedildi: gecersiz veya eksik JWT");
            throw new AccessDeniedException("WebSocket baglantisi icin gecerli oturum gereklidir");
        }
        AuthenticatedUser user = session.get().user();
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))));
        if (accessor.getSessionAttributes() != null) {
            accessor.getSessionAttributes().put("user", user);
        }
        sessionRegistry.bind(accessor.getSessionId(), user.username());
    }

    private AuthenticatedUser requireUser(StompHeaderAccessor accessor) {
        Principal principal = accessor.getUser();
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        if (accessor.getSessionAttributes() != null
                && accessor.getSessionAttributes().get("user") instanceof AuthenticatedUser user) {
            return user;
        }
        throw new AccessDeniedException("WebSocket oturumu dogrulanmamis");
    }
}
