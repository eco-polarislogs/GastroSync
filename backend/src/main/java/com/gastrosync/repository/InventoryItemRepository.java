package com.gastrosync.repository;

import com.gastrosync.model.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByBarcode(String barcode);
    Optional<InventoryItem> findByNameIgnoreCase(String name);
    Optional<InventoryItem> findFirstByNameIgnoreCase(String name);
    Optional<InventoryItem> findFirstByNameContainingIgnoreCase(String name);
}
