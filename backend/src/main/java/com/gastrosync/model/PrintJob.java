package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** Yazdirma isi: her baski kayit altindadir; basarisiz is yeniden denenebilir. */
@Entity
@Table(name = "print_jobs", indexes = {
        @Index(name = "idx_print_job_status", columnList = "status"),
        @Index(name = "idx_print_job_created", columnList = "created_at")
})
public class PrintJob {

    public static final String PENDING = "PENDING";
    public static final String PRINTED = "PRINTED";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "printer_id", nullable = false)
    private Long printerId;

    @Column(name = "printer_name", length = 60)
    private String printerName;

    @Column(nullable = false, length = 10)
    private String connection;

    @Column(nullable = false, length = 120)
    private String host;

    @Column(nullable = false)
    private Integer port;

    /** KITCHEN_TICKET · BILL · RECEIPT · TEST */
    @Column(nullable = false, length = 20)
    private String type;

    @Column(length = 120)
    private String title;

    /** ESC/POS baytlari (Base64) */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false, length = 10)
    private String status = PENDING;

    @Column(nullable = false)
    private Integer attempts = 0;

    @Column(length = 300)
    private String error;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "printed_at")
    private LocalDateTime printedAt;

    @Column(name = "printed_by", length = 120)
    private String printedBy;

    public Long getId() { return id; }
    public Long getPrinterId() { return printerId; }
    public void setPrinterId(Long printerId) { this.printerId = printerId; }
    public String getPrinterName() { return printerName; }
    public void setPrinterName(String printerName) { this.printerName = printerName; }
    public String getConnection() { return connection; }
    public void setConnection(String connection) { this.connection = connection; }
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getAttempts() { return attempts; }
    public void setAttempts(Integer attempts) { this.attempts = attempts; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getPrintedAt() { return printedAt; }
    public void setPrintedAt(LocalDateTime printedAt) { this.printedAt = printedAt; }
    public String getPrintedBy() { return printedBy; }
    public void setPrintedBy(String printedBy) { this.printedBy = printedBy; }
}
