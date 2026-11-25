package com.gastrosync.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gastrosync.model.Printer;

public interface PrinterRepository extends JpaRepository<Printer, Long> {

    List<Printer> findAllByOrderByStationAscNameAsc();

    List<Printer> findByStationAndActiveTrue(String station);

}
