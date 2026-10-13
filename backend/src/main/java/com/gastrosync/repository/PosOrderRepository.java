package com.gastrosync.repository;

import com.gastrosync.model.PosOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface PosOrderRepository extends JpaRepository<PosOrder, Long> {
    List<PosOrder> findByStatus(String status);

    @Query("SELECT COALESCE(SUM(p.totalAmount), 0) FROM PosOrder p WHERE p.status = 'COMPLETED'")
    BigDecimal calculateTotalRevenue();

    @Query("SELECT COALESCE(SUM(p.totalCost), 0) FROM PosOrder p WHERE p.status = 'COMPLETED'")
    BigDecimal calculateTotalCost();
}
