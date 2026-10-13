package com.gastrosync.repository;

import com.gastrosync.model.StockTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockTransactionRepository extends JpaRepository<StockTransaction, Long> {
    List<StockTransaction> findByItemId(Long itemId);
    List<StockTransaction> findByType(String type);
    List<StockTransaction> findByTimestampBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT st FROM StockTransaction st ORDER BY st.timestamp DESC")
    List<StockTransaction> findRecentTransactions();

    @Query("SELECT st FROM StockTransaction st WHERE st.type = 'WASTE' ORDER BY st.timestamp DESC")
    List<StockTransaction> findAllWasteRecords();
}
