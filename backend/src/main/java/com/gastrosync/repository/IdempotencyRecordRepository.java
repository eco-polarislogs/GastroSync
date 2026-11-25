package com.gastrosync.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.IdempotencyRecord;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, Long> {

    Optional<IdempotencyRecord> findByUsernameAndIdemKey(String username, String idemKey);

    @Modifying
    @Transactional
    @Query("delete from IdempotencyRecord r where r.createdAt < :before")
    int deleteOlderThan(LocalDateTime before);
}
