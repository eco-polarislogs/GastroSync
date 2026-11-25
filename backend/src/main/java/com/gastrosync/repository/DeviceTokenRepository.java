package com.gastrosync.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.DeviceToken;

@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    Optional<DeviceToken> findByToken(String token);

    List<DeviceToken> findByUsernameIgnoreCase(String username);

    @Query("SELECT d FROM DeviceToken d WHERE LOWER(d.username) IN :usernames")
    List<DeviceToken> findByUsernamesLower(@Param("usernames") Collection<String> lowerUsernames);

    @Modifying
    @Query("DELETE FROM DeviceToken d WHERE d.token IN :tokens")
    int deleteByTokens(@Param("tokens") Collection<String> tokens);

    @Modifying
    @Query("DELETE FROM DeviceToken d WHERE LOWER(d.username) = LOWER(:username)")
    int deleteByUsername(@Param("username") String username);
}
