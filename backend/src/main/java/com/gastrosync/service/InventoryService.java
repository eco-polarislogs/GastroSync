package com.gastrosync.service;

import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.StockTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class InventoryService {

    private final InventoryItemRepository itemRepository;
    private final StockTransactionRepository transactionRepository;

    public InventoryService(InventoryItemRepository itemRepository, StockTransactionRepository transactionRepository) {
        this.itemRepository = itemRepository;
        this.transactionRepository = transactionRepository;
    }

    public List<InventoryItem> getAllItems() {
        return itemRepository.findAll();
    }

    public Optional<InventoryItem> getItemById(Long id) {
        return itemRepository.findById(id);
    }

    public Optional<InventoryItem> getItemByBarcode(String barcode) {
        return itemRepository.findByBarcode(barcode);
    }

    public InventoryItem saveItem(InventoryItem item) {
        if (item.getLastUpdated() == null) {
            item.setLastUpdated(LocalDateTime.now().toString());
        }
        return itemRepository.save(item);
    }

    /**
     * Mal kabul işlemi: Stoğu artırır ve denetim hareketi kaydeder.
     */
    public StockTransaction receiveStock(Long itemId, BigDecimal quantity, String recordedBy) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Ürün bulunamadı: ID " + itemId));

        item.setCurrentStock(item.getCurrentStock().add(quantity));
        item.setLastUpdated("Bugün " + LocalDateTime.now().getHour() + ":" + String.format("%02d", LocalDateTime.now().getMinute()));
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction(item, "INBOUND", quantity, item.getUnitCost(), "Mal Kabul", recordedBy);
        return transactionRepository.save(tx);
    }

    /**
     * Zayiat / Fire bildirimi: Stoğu düşer, maliyeti hesaplar ve denetim kaydı oluşturur.
     */
    public StockTransaction recordWaste(Long itemId, BigDecimal quantity, String reason, String recordedBy) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Ürün bulunamadı: ID " + itemId));

        BigDecimal newStock = item.getCurrentStock().subtract(quantity);
        item.setCurrentStock(newStock.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newStock);
        item.setLastUpdated("Bugün " + LocalDateTime.now().getHour() + ":" + String.format("%02d", LocalDateTime.now().getMinute()));
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction(item, "WASTE", quantity, item.getUnitCost(), reason, recordedBy);
        return transactionRepository.save(tx);
    }

    public List<StockTransaction> getRecentTransactions() {
        return transactionRepository.findRecentTransactions();
    }

    public List<StockTransaction> getWasteRecords() {
        return transactionRepository.findAllWasteRecords();
    }
}
