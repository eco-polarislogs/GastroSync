package com.gastrosync.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.Expense;

import jakarta.persistence.LockModeType;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long>, JpaSpecificationExecutor<Expense> {
    List<Expense> findByCategory(String category);
    List<Expense> findByPeriod(String period);
    List<Expense> findAllByOrderByExpenseDateDescIdDesc();
    List<Expense> findByPeriodOrderByExpenseDateDescIdDesc(String period);
    long countByPeriodAndStatusIn(String period, Collection<String> statuses);
    List<Expense> findByStatusInAndDueDateLessThanEqual(Collection<String> statuses, LocalDate date);
    List<Expense> findBySubTypeInAndInventoryItemIdIsNotNullAndStatusInOrderByDueDateAsc(Collection<String> subTypes, Collection<String> statuses);

    /** Durum gecislerinde yaris kosulunu (iki kisinin ayni anda onaylamasi) engeller */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Expense e WHERE e.id = :id")
    Optional<Expense> findByIdForUpdate(@Param("id") Long id);
}
