package com.gastrosync.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.ChatMessage;
import com.gastrosync.service.ChatService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/chat")
@Tag(name = "Ekip İçi Sohbet", description = "Mutfak, Kasa, Vardiya ve Genel departmanlar arası anlık ekip mesajlaşması")
@PreAuthorize("isAuthenticated()")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/messages")
    @Operation(summary = "Tüm sohbet mesajlarını veya kanala göre filtrelenmiş mesajları getir")
    public ResponseEntity<ApiResponse<List<ChatMessage>>> getMessages(
            @RequestParam(name = "channelId", required = false) String channelId) {
        List<ChatMessage> list = chatService.getMessagesByChannel(channelId);
        return ResponseEntity.ok(ApiResponse.ok("Mesajlar başarıyla getirildi", list));
    }

    @PostMapping("/messages")
    @Operation(summary = "Yeni ekip sohbet mesajı gönder ve bildirim üret")
    public ResponseEntity<ApiResponse<ChatMessage>> sendMessage(@RequestBody ChatMessage message) {
        if (message.getText() == null || message.getText().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Mesaj metni boş olamaz"));
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            // Güvenli kimlik bağlama: Gönderen boşsa veya sahte isim içeriyorsa JWT oturumundaki bilgileri esas al
            if (message.getSender() == null || message.getSender().trim().isEmpty()) {
                message.setSender(auth.getName());
            }
            if (message.getRole() == null || message.getRole().trim().isEmpty()) {
                String role = auth.getAuthorities().stream()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .findFirst()
                        .orElse("user");
                message.setRole(role);
            }
        }

        ChatMessage saved = chatService.sendMessage(message);
        return ResponseEntity.ok(ApiResponse.ok("Mesaj başarıyla iletildi ve kaydedildi", saved));
    }

    @org.springframework.messaging.handler.annotation.MessageMapping("/chat.sendMessage")
    public void handleStompMessage(@org.springframework.messaging.handler.annotation.Payload ChatMessage message) {
        if (message != null && message.getText() != null && !message.getText().trim().isEmpty()) {
            chatService.sendMessage(message);
        }
    }
}
