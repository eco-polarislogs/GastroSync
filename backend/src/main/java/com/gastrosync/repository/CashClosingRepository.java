package com.gastrosync.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.CashClosing;

@Repository
public interface CashClosingRepository extends JpaRepository<CashClosing, Long> {
    List<CashClosing> findByBusinessDateOrderByClosedAtAsc(LocalDate businessDate);
    List<CashClosing> findByBusinessDateBetweenOrderByBusinessDateDescClosedAtDesc(LocalDate from, LocalDate to);
}
