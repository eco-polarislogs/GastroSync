package com.gastrosync.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.ExpensePayment;

@Repository
public interface ExpensePaymentRepository extends JpaRepository<ExpensePayment, Long> {
    List<ExpensePayment> findByExpenseIdOrderByCreatedAtAsc(Long expenseId);
    List<ExpensePayment> findByPaymentDateBetweenOrderByCreatedAtAsc(LocalDate from, LocalDate to);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ExpensePayment p WHERE p.paymentDate = :date AND p.method = :method")
    BigDecimal sumByDateAndMethod(@Param("date") LocalDate date, @Param("method") String method);
}
