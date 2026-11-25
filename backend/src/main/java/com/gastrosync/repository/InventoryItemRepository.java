package com.gastrosync.repository;

import java.util.List;
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
    // Eski veride ayni barkod / isim birden fazla kartta kalmis olabilir: tekil sonuc beklenmez
    Optional<InventoryItem> findFirstByBarcodeOrderByIdAsc(String barcode);
    boolean existsByBarcode(String barcode);
    boolean existsByBarcodeAndIdNot(String barcode, Long id);
    boolean existsByNameIgnoreCase(String name);
    Optional<InventoryItem> findFirstByNameIgnoreCase(String name);
    Optional<InventoryItem> findFirstByNameContainingIgnoreCase(String name);
    List<InventoryItem> findAllByOrderByNameAsc();

    /** Satir duzeyinde kilit: es zamanli mal kabul / satis / sayim islemlerinde kayip guncellemeyi engeller */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM InventoryItem i WHERE i.id = :id")
    Optional<InventoryItem> findByIdForUpdate(@Param("id") Long id);
}
