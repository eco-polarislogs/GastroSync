package com.gastrosync.controller;

import com.gastrosync.model.SalesRecord;
import com.gastrosync.repository.SalesRecordRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
public class SalesController {

    private final SalesRecordRepository repository;

    public SalesController(SalesRecordRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<SalesRecord> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public SalesRecord create(@RequestBody SalesRecord salesRecord) {
        return repository.save(salesRecord);
    }
}
