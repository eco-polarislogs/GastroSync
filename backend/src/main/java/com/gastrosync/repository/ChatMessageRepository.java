package com.gastrosync.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.ChatMessage;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findAllByOrderByCreatedAtAsc();
    List<ChatMessage> findByChannelIdOrderByCreatedAtAsc(String channelId);

    @Query("SELECT MAX(m.id) FROM ChatMessage m WHERE m.channelId = :ch")
    Long maxIdByChannel(@Param("ch") String channelId);

    /** Okunmamis mesaj sayisi (kullanicinin kendi mesajlari ve kendi adina uretilen sistem mesajlari haric) */
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.channelId = :ch AND m.id > :after AND "
            + "((m.senderUsername IS NOT NULL AND m.senderUsername <> :me) OR "
            + "(m.senderUsername IS NULL AND (m.sender IS NULL OR m.sender <> :myName)))")
    long countUnread(@Param("ch") String channelId, @Param("after") Long after,
                     @Param("me") String username, @Param("myName") String displayName);
}
