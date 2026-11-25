package com.gastrosync.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.ApprovalRequest;

import jakarta.persistence.LockModeType;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {

    boolean existsByTargetTypeAndTargetIdAndTypeAndStatus(String targetType, Long targetId, String type, String status);

    List<ApprovalRequest> findByCheckIdAndStatus(Long checkId, String status);

    List<ApprovalRequest> findByTargetTypeAndTargetIdAndStatus(String targetType, Long targetId, String status);

    List<ApprovalRequest> findByCheckIdInAndStatus(Collection<Long> checkIds, String status);

    long countByStatusAndApproverPermissionIn(String status, Collection<String> permissions);

    long countByStatusAndRequestedBy(String status, String requestedBy);

    @Query("SELECT a FROM ApprovalRequest a WHERE a.approverPermission IN :perms AND (:status IS NULL OR a.status = :status) "
            + "ORDER BY CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END, a.requestedAt DESC")
    Page<ApprovalRequest> inbox(@Param("perms") Collection<String> perms, @Param("status") String status, Pageable pageable);

    @Query("SELECT a FROM ApprovalRequest a WHERE a.requestedBy = :username AND (:status IS NULL OR a.status = :status) "
            + "ORDER BY CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END, a.requestedAt DESC")
    Page<ApprovalRequest> mine(@Param("username") String username, @Param("status") String status, Pageable pageable);

    @Query("SELECT a FROM ApprovalRequest a WHERE (:status IS NULL OR a.status = :status) ORDER BY a.requestedAt DESC")
    Page<ApprovalRequest> all(@Param("status") String status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM ApprovalRequest a WHERE a.id = :id")
    Optional<ApprovalRequest> findByIdForUpdate(@Param("id") Long id);
}
