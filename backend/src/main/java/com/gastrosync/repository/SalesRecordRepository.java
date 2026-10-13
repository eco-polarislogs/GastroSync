package com.gastrosync.repository;

import com.gastrosync.model.SalesRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SalesRecordRepository extends JpaRepository<SalesRecord, Long> {
}
