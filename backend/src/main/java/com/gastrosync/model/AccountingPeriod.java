package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Muhasebe donemi (YYYY-MM). Mali Musavir donemi kapattiginda o doneme ait
 * gider/satis kayitlari olusturulamaz, degistirilemez veya iptal edilemez.
 * Kaydi olmayan donem ACIK kabul edilir.
 */
@Entity
@Table(name = "accounting_periods", uniqueConstraints = @UniqueConstraint(name = "uk_accounting_period", columnNames = "period"))
public class AccountingPeriod {

    public static final String OPEN = "OPEN";
    public static final String CLOSED = "CLOSED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 7)
    private String period;

    @Column(nullable = false, length = 10)
    private String status = OPEN;

    private String closedBy;
    private LocalDateTime closedAt;
    private String reopenedBy;
    private LocalDateTime reopenedAt;

    @Column(length = 1000)
    private String note;

    public AccountingPeriod() {}

    public AccountingPeriod(String period) {
        this.period = period;
        this.status = OPEN;
    }

    public boolean isClosed() { return CLOSED.equals(status); }

    public Long getId() { return id; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public String getReopenedBy() { return reopenedBy; }
    public void setReopenedBy(String reopenedBy) { this.reopenedBy = reopenedBy; }
    public LocalDateTime getReopenedAt() { return reopenedAt; }
    public void setReopenedAt(LocalDateTime reopenedAt) { this.reopenedAt = reopenedAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
