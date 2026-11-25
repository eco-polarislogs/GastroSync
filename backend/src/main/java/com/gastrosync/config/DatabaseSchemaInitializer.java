package com.gastrosync.config;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Eski surumlerden kalan veritabanlarini yeni modele uyumlu hale getirir (idempotent).
 *  - Denetim / arsiv kolonlarini ekler
 *  - Eski gider durumlarini yeni durum makinesine esler
 *  - Eksik odeme / KDV / satis alanlarini guvenli varsayilanlarla doldurur
 *
 * Not: Silinmis (arsivlenmis) kullanicilar ASLA otomatik geri getirilmez.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DatabaseSchemaInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        List<String> auditedTables = List.of("users", "expenses", "inventory_items", "recipes");
        for (String table : auditedTables) {
            if (tableExists(table)) {
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false");
                executeSilent("UPDATE " + table + " SET is_deleted = false WHERE is_deleted IS NULL");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS deleted_at timestamp");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS deleted_by varchar(100)");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP");
                executeSilent("UPDATE " + table + " SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS updated_at timestamp");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS created_by varchar(100) DEFAULT 'SYSTEM'");
                executeSilent("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS updated_by varchar(100)");
            }
        }

        if (tableExists("users")) {
            executeSilent("UPDATE users SET is_active = true WHERE is_active IS NULL");
            executeSilent("UPDATE users SET must_change_password = false WHERE must_change_password IS NULL");
            executeSilent("UPDATE users SET role = UPPER(role) WHERE role <> UPPER(role)");
        }

        if (tableExists("expenses")) {
            executeSilent("UPDATE expenses SET status = 'FINALIZED' WHERE status = 'APPROVED_IN_LEDGER'");
            executeSilent("UPDATE expenses SET status = 'APPROVED' WHERE status = 'SENT_TO_ADVISOR'");
            executeSilent("UPDATE expenses SET status = 'REJECTED' WHERE status = 'NEEDS_CORRECTION'");
            executeSilent("UPDATE expenses SET status = 'PENDING_APPROVAL' WHERE status IS NULL "
                    + "OR status NOT IN ('PENDING_APPROVAL','APPROVED','FINALIZED','REJECTED')");
            executeSilent("UPDATE expenses SET paid_amount = amount WHERE paid_amount IS NULL AND (payment_status = 'PAID' OR paid_by_cashier = true)");
            executeSilent("UPDATE expenses SET paid_amount = 0 WHERE paid_amount IS NULL");
            executeSilent("UPDATE expenses SET vat_rate = 0 WHERE vat_rate IS NULL");
            executeSilent("UPDATE expenses SET payment_status = CASE WHEN paid_amount >= amount THEN 'PAID' "
                    + "WHEN paid_amount > 0 THEN 'PARTIAL' ELSE 'UNPAID' END WHERE payment_status IS NULL");
            executeSilent("UPDATE expenses SET recorded_in_ledger = (status = 'FINALIZED')");
        }

        if (tableExists("sales_records")) {
            executeSilent("UPDATE sales_records SET status = 'COMPLETED' WHERE status IS NULL");
            executeSilent("UPDATE sales_records SET sold_at = CURRENT_TIMESTAMP WHERE sold_at IS NULL");
            executeSilent("UPDATE sales_records SET vat_rate = 10 WHERE vat_rate IS NULL");
            executeSilent("UPDATE sales_records SET vat_amount = ROUND(total_price * vat_rate / (100 + vat_rate), 2) WHERE vat_amount IS NULL");
            executeSilent("UPDATE sales_records SET payment_method = 'CASH' WHERE payment_method IN ('Nakit', 'NAKIT')");
            executeSilent("UPDATE sales_records SET payment_method = 'CREDIT_CARD' WHERE payment_method IN ('Kredi Karti', 'Kredi Kartı', 'CARD')");
            executeSilent("UPDATE sales_records SET payment_method = 'MEAL_CARD' WHERE payment_method IN ('Yemek Karti', 'Yemek Kartı')");
        }
        log.info("Veritabani uyumluluk kontrolu tamamlandi");
    }

    private boolean tableExists(String table) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE LOWER(table_name) = ?", Integer.class, table);
            return count != null && count > 0;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private void executeSilent(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (RuntimeException e) {
            log.debug("Uyumluluk adimi atlandi: {} -> {}", sql, e.getMessage());
        }
    }
}
