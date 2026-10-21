package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(
    name = "chat_messages",
    indexes = {
        @Index(name = "idx_chat_messages_channel", columnList = "channelId"),
        @Index(name = "idx_chat_messages_created_at", columnList = "createdAt ASC")
    }
)
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String channelId; // general, kitchen, cashier, shift

    @Column(nullable = false)
    private String sender; // Mehmet Şef, Canan Kasa, vb.

    @Column(nullable = false)
    private String role; // chef, accountant, warehouse, etc.

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    private String time; // 10:15

    private String avatar; // MŞ, CK, etc.

    private String priority = "normal"; // normal, urgent

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.priority == null) {
            this.priority = "normal";
        }
    }

    public ChatMessage() {
        this.createdAt = LocalDateTime.now();
    }

    public ChatMessage(String channelId, String sender, String role, String text, String time, String avatar, String priority) {
        this.channelId = channelId;
        this.sender = sender;
        this.role = role;
        this.text = text;
        this.time = time;
        this.avatar = avatar;
        this.priority = priority != null ? priority : "normal";
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getChannelId() {
        return channelId;
    }

    public void setChannelId(String channelId) {
        this.channelId = channelId;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
