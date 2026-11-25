package com.gastrosync.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.TableCheck;

import jakarta.persistence.LockModeType;

@Repository
public interface TableCheckRepository extends JpaRepository<TableCheck, Long> {
    List<TableCheck> findByStatus(String status);
    Optional<TableCheck> findFirstByTableIdAndStatus(Long tableId, String status);
    boolean existsByCheckNo(String checkNo);
    long countByCheckNoStartingWith(String prefix);
    Page<TableCheck> findByStatusAndClosedAtBetweenOrderByClosedAtDesc(String status, LocalDateTime from, LocalDateTime to, Pageable pageable);
    List<TableCheck> findByStatusAndClosedAtBetween(String status, LocalDateTime from, LocalDateTime to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM TableCheck c WHERE c.id = :id")
    Optional<TableCheck> findByIdForUpdate(@Param("id") Long id);
}
