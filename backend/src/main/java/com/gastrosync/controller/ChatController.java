package com.gastrosync.controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.ChatMessage;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.service.ChatService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/chat")
@Tag(name = "Ekip Ici Sohbet", description = "Rol yetkili departman kanallari")
@PreAuthorize("isAuthenticated()")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final ChatService chatService;
    private final CurrentUserService currentUserService;

    public ChatController(ChatService chatService, CurrentUserService currentUserService) {
        this.chatService = chatService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/channels")
    @Operation(summary = "Kullanicinin erisebildigi sohbet kanallari")
    public ResponseEntity<ApiResponse<List<String>>> channels() {
        return ResponseEntity.ok(ApiResponse.ok("Kanallar", AppRoles.accessibleChannels(currentUserService.require().role())));
    }

    @GetMapping("/messages")
    @Operation(summary = "Kanal mesajlari (kanal verilmezse erisilebilen tum kanallar)")
    public ResponseEntity<ApiResponse<List<ChatMessage>>> getMessages(
            @RequestParam(name = "channelId", required = false) String channelId) {
        return ResponseEntity.ok(ApiResponse.ok("Mesajlar getirildi",
                chatService.getMessagesFor(currentUserService.require(), channelId)));
    }

    @PostMapping("/messages")
    @Operation(summary = "Kanala mesaj gonder (gonderen kimligi oturumdan alinir)")
    public ResponseEntity<ApiResponse<ChatMessage>> sendMessage(@RequestBody Map<String, Object> body) {
        String channel = str(body.get("channelId"));
        String text = str(body.get("text"));
        String priority = str(body.get("priority"));
        ChatMessage saved = chatService.send(currentUserService.require(), channel, text, priority);
        return ResponseEntity.ok(ApiResponse.ok("Mesaj iletildi", saved));
    }

    @GetMapping("/unread")
    @Operation(summary = "Kanal bazli okunmamis mesaj sayilari (web ve mobil ayni durumu gorur)")
    public ResponseEntity<ApiResponse<Map<String, Long>>> unread() {
        return ResponseEntity.ok(ApiResponse.ok("Okunmamis mesajlar", chatService.unreadCounts(currentUserService.require())));
    }

    @PutMapping("/channels/{channelId}/read")
    @Operation(summary = "Kanali okundu isaretle (diger cihazlara /user/queue/chat-read ile iletilir)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markRead(@PathVariable("channelId") String channelId,
                                                                     @RequestBody(required = false) Map<String, Object> body) {
        Long upTo = null;
        if (body != null && body.get("lastMessageId") != null) {
            try {
                upTo = Long.valueOf(body.get("lastMessageId").toString().replace(".0", ""));
            } catch (NumberFormatException ignored) {
                upTo = null;
            }
        }
        return ResponseEntity.ok(ApiResponse.ok("Kanal okundu", chatService.markRead(currentUserService.require(), channelId, upTo)));
    }

    /** STOMP uzerinden mesaj (istemci REST'i tercih etmelidir; ikisi birden kullanilmamalidir) */
    @MessageMapping("/chat.sendMessage")
    public void handleStompMessage(@Payload Map<String, Object> body, Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof AuthenticatedUser user) {
            try {
                chatService.send(user, str(body.get("channelId")), str(body.get("text")), str(body.get("priority")));
            } catch (RuntimeException ex) {
                log.warn("STOMP sohbet mesaji reddedildi: {}", ex.getMessage());
            }
        }
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
