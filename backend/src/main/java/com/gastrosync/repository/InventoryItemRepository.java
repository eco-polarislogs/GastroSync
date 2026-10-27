package com.gastrosync.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.InventoryItem;

import jakarta.persistence.LockModeType;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    Optional<InventoryItem> findByBarcode(String barcode);

    Optional<InventoryItem> findByNameIgnoreCase(String name);

    Optional<InventoryItem> findFirstByNameIgnoreCase(String name);

    Optional<InventoryItem> findFirstByNameContainingIgnoreCase(String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM InventoryItem i WHERE i.id = :id")
    Optional<InventoryItem> findByIdForUpdate(@Param("id") Long id);
}

