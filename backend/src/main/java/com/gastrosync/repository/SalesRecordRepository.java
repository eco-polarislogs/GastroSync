package com.gastrosync.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.SalesRecord;

@Repository
public interface SalesRecordRepository extends JpaRepository<SalesRecord, Long>, JpaSpecificationExecutor<SalesRecord> {
    List<SalesRecord> findBySoldAtBetweenOrderBySoldAtDesc(LocalDateTime from, LocalDateTime to);
    List<SalesRecord> findBySoldAtBetweenAndStatusOrderBySoldAtDesc(LocalDateTime from, LocalDateTime to, String status);
    List<SalesRecord> findAllByOrderBySoldAtDescIdDesc();
    List<SalesRecord> findByOrderNo(String orderNo);
}
