package com.gastrosync.repository;

import com.gastrosync.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByCategory(String category);
    List<Expense> findByPeriod(String period);
    List<Expense> findAllByOrderByExpenseDateDescIdDesc();
}
