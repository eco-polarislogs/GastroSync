package com.gastrosync.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.NotificationRead;

@Repository
public interface NotificationReadRepository extends JpaRepository<NotificationRead, Long> {
    boolean existsByNotificationIdAndUsername(Long notificationId, String username);

    @Query("SELECT r.notificationId FROM NotificationRead r WHERE r.username = :username AND r.notificationId IN :ids")
    List<Long> findReadIds(@Param("username") String username, @Param("ids") Collection<Long> ids);
}
