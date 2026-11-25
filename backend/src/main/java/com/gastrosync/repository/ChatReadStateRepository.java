package com.gastrosync.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.ChatReadState;

@Repository
public interface ChatReadStateRepository extends JpaRepository<ChatReadState, Long> {
    List<ChatReadState> findByUsername(String username);
    Optional<ChatReadState> findByUsernameAndChannelId(String username, String channelId);
}
