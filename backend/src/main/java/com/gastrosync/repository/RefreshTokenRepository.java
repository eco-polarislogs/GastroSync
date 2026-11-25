package com.gastrosync.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.RefreshToken;

import jakarta.persistence.LockModeType;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM RefreshToken t WHERE t.tokenHash = :hash")
    Optional<RefreshToken> findByHashForUpdate(@Param("hash") String hash);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByUsernameIgnoreCaseAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(String username, LocalDateTime now);

    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :now, t.revokeReason = :reason WHERE t.familyId = :family AND t.revokedAt IS NULL")
    int revokeFamily(@Param("family") String familyId, @Param("now") LocalDateTime now, @Param("reason") String reason);

    @Modifying
    @Query("UPDATE RefreshToken t SET t.revokedAt = :now, t.revokeReason = :reason WHERE LOWER(t.username) = LOWER(:username) AND t.revokedAt IS NULL")
    int revokeAllForUser(@Param("username") String username, @Param("now") LocalDateTime now, @Param("reason") String reason);

    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") LocalDateTime before);
}
