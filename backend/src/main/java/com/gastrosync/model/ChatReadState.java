package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Kullanicinin her sohbet kanalinda en son okudugu mesaj. Web ve mobil ayni kaydi kullanir;
 * bir cihazda okunan kanal digerinde de okunmus gorunur.
 */
@Entity
@Table(
    name = "chat_read_states",
    uniqueConstraints = @UniqueConstraint(name = "uk_chat_read_user_channel", columnNames = {"username", "channelId"}),
    indexes = @Index(name = "idx_chat_read_user", columnList = "username")
)
public class ChatReadState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(nullable = false, length = 40)
    private String channelId;

    @Column(nullable = false)
    private Long lastReadMessageId = 0L;

    private LocalDateTime updatedAt;

    public ChatReadState() {}

    public ChatReadState(String username, String channelId, Long lastReadMessageId) {
        this.username = username;
        this.channelId = channelId;
        this.lastReadMessageId = lastReadMessageId == null ? 0L : lastReadMessageId;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getChannelId() { return channelId; }
    public void setChannelId(String channelId) { this.channelId = channelId; }
    public Long getLastReadMessageId() { return lastReadMessageId == null ? 0L : lastReadMessageId; }
    public void setLastReadMessageId(Long lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
