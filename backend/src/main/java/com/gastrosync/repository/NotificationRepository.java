package com.gastrosync.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.Notification;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByOrderByCreatedAtDesc();
    List<Notification> findByTargetRoleInOrderByCreatedAtDesc(List<String> targetRoles);
    List<Notification> findTop200ByOrderByCreatedAtDesc();

    /**
     * targetRole tek rol ("ACCOUNTANT"), birden fazla rol ("ACCOUNTANT,MANAGER") veya "ALL" olabilir.
     */
    @Query("SELECT n FROM Notification n WHERE n.targetRole = 'ALL' OR n.targetRole = :role "
            + "OR n.targetRole LIKE CONCAT(:role, ',%') OR n.targetRole LIKE CONCAT('%,', :role) "
            + "OR n.targetRole LIKE CONCAT('%,', :role, ',%') ORDER BY n.createdAt DESC")
    List<Notification> findVisibleForRole(@Param("role") String role);
}
