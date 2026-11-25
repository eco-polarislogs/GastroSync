package com.gastrosync.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Restoran masasi. Her masanin benzersiz bir numarasi vardir; adisyonlar masa numarasina acilir. */
@Entity
@Table(name = "dining_tables", uniqueConstraints = @UniqueConstraint(name = "uk_dining_table_number", columnNames = "number"))
public class DiningTable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer number;

    /** Salon, Bahce, Teras, Bar ... */
    @Column(nullable = false, length = 40)
    private String area = "Salon";

    @Column(nullable = false)
    private Integer capacity = 4;

    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(length = 100)
    private String createdBy;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (active == null) active = Boolean.TRUE;
    }

    public DiningTable() {}

    public DiningTable(Integer number, String area, Integer capacity) {
        this.number = number;
        this.area = area;
        this.capacity = capacity;
    }

    public String label() { return "Masa " + number; }

    public Long getId() { return id; }
    public Integer getNumber() { return number; }
    public void setNumber(Integer number) { this.number = number; }
    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
