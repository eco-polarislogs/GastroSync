package com.gastrosync.model;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * Abstract Base Entity providing enterprise-grade Audit Logging and Soft Delete capabilities.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN & DEFENSE NOTES (Thesis Defense)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. @MappedSuperclass:
 *    Instructs JPA that this class does not have its own database table.
 *    Instead, all mapping attributes defined here are inherited by child entity tables
 *    (expenses, users, inventory_items, etc.). This enforces DRY and domain consistency.
 *
 * 2. @EntityListeners(AuditingEntityListener.class):
 *    Plugs into JPA lifecycle events. Whenever an entity is persisted (INSERT)
 *    or updated (UPDATE), Spring Data JPA automatically intercepts the call and
 *    populates the @CreatedDate, @LastModifiedDate, @CreatedBy, and @LastModifiedBy
 *    fields using the configured AuditorAware bean.
 *
 * 3. IMMUTABILITY OF AUDIT TRAILS:
 *    - `updatable = false` on `createdAt` and `createdBy` guarantees that no application
 *      logic or malicious update can tamper with the original creation timestamp or author.
 *
 * 4. SOFT DELETE ARCHITECTURE:
 *    - `isDeleted`: Logical deletion flag.
 *    - `deletedAt`: Exact moment of logical deletion.
 *    - `deletedBy`: Operator who marked the record as deleted.
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseAuditableEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false, length = 100)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by", length = 100)
    private String lastModifiedBy;

    // ── SOFT DELETE METADATA ────────────────────────────────────────────────
    @Column(name = "is_deleted", nullable = false, columnDefinition = "boolean default false")
    private boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by", length = 100)
    private String deletedBy;

    // Getters and Setters
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getLastModifiedBy() { return lastModifiedBy; }
    public void setLastModifiedBy(String lastModifiedBy) { this.lastModifiedBy = lastModifiedBy; }

    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }

    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }

    /**
     * Helper to perform programmatic soft deletion.
     */
    public void markDeleted(String operator) {
        this.isDeleted = true;
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = operator;
    }
}
