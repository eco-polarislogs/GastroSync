package com.gastrosync.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gastrosync.model.PrintJob;

public interface PrintJobRepository extends JpaRepository<PrintJob, Long> {

    List<PrintJob> findTop50ByOrderByCreatedAtDesc();

    List<PrintJob> findTop20ByConnectionAndStatusOrderByCreatedAtAsc(String connection, String status);
}
