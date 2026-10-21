package com.gastrosync.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
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
        ChatMessage saved = chatService.sendMessage(message);
        return ResponseEntity.ok(ApiResponse.ok("Mesaj başarıyla iletildi ve kaydedildi", saved));
    }
}
