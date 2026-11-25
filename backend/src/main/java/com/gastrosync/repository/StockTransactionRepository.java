package com.gastrosync.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.StockTransaction;

@Repository
public interface StockTransactionRepository extends JpaRepository<StockTransaction, Long>, JpaSpecificationExecutor<StockTransaction> {
    List<StockTransaction> findByItemId(Long itemId);
    List<StockTransaction> findByType(String type);
    List<StockTransaction> findByTimestampBetween(LocalDateTime start, LocalDateTime end);

    /** Alis fiyati gecmisi (mal kabul hareketleri, eskiden yeniye) */
    @Query("SELECT st FROM StockTransaction st JOIN FETCH st.item WHERE st.type = 'INBOUND' ORDER BY st.timestamp ASC, st.id ASC")
    List<StockTransaction> findInboundHistory();

    Optional<StockTransaction> findFirstByItem_IdAndTypeOrderByTimestampDescIdDesc(Long itemId, String type);
    List<StockTransaction> findByReferenceTypeAndReferenceIdAndType(String referenceType, Long referenceId, String type);

    @Query("SELECT st FROM StockTransaction st JOIN FETCH st.item ORDER BY st.timestamp DESC")
    List<StockTransaction> findRecentTransactions(Pageable pageable);

    @Query("SELECT st FROM StockTransaction st JOIN FETCH st.item WHERE st.item.id = :itemId ORDER BY st.timestamp DESC")
    List<StockTransaction> findByItemIdOrderByTimestampDesc(@Param("itemId") Long itemId, Pageable pageable);

    @Query("SELECT st FROM StockTransaction st JOIN FETCH st.item WHERE st.type = 'WASTE' ORDER BY st.timestamp DESC")
    List<StockTransaction> findAllWasteRecords();

    /** Net satilan mal maliyeti = satis tuketimi - iptal iadeleri */
    @Query("SELECT COALESCE(SUM(CASE WHEN st.type = 'OUTBOUND_SALE' THEN st.totalAmount "
            + "WHEN st.type = 'SALE_REVERSAL' THEN -st.totalAmount ELSE 0 END), 0) FROM StockTransaction st")
    BigDecimal calculateTotalCogs();

    @Query("SELECT COALESCE(SUM(CASE WHEN st.type = 'OUTBOUND_SALE' THEN st.totalAmount "
            + "WHEN st.type = 'SALE_REVERSAL' THEN -st.totalAmount ELSE 0 END), 0) FROM StockTransaction st "
            + "WHERE st.timestamp >= :from AND st.timestamp < :to")
    BigDecimal calculateCogsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT COALESCE(SUM(st.totalAmount), 0) FROM StockTransaction st "
            + "WHERE st.type = :type AND st.timestamp >= :from AND st.timestamp < :to")
    BigDecimal sumByTypeBetween(@Param("type") String type, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
