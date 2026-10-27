package com.gastrosync.model.enums;

/**
 * Type-safe enumeration of all roles in the GastroSync ERP system.
 *
 * WHY an Enum instead of String?
 * ──────────────────────────────
 * 1. COMPILE-TIME SAFETY: A typo like "ADMN" would be caught at compile time, not
 *    at runtime when a user mysteriously can't access a feature.
 * 2. EXHAUSTIVE SWITCH: Java 21 sealed switch expressions guarantee we handle every
 *    role — the compiler warns if we forget one.
 * 3. SINGLE SOURCE OF TRUTH: All valid roles are defined in ONE place. Adding a new
 *    role (e.g., WAITER) requires updating only this enum — Spring Security's
 *    @PreAuthorize annotations reference these values automatically.
 * 4. RBAC CLARITY: Each role has a clear, documented responsibility. This is critical
 *    for the graduation jury to understand the authorization matrix.
 *
 * THESIS NOTE: This follows the "Replace Type Code with Class" refactoring pattern
 * (Martin Fowler, Refactoring 2nd Ed.), converting a primitive obsession (String role)
 * into a proper domain type.
 */
public enum Role {

    /** Full system access — user management, configuration, all operations */
    ADMIN,

    /** Restaurant floor operations — staff scheduling, daily reports, menu management */
    MANAGER,

    /** Kitchen operations — recipe viewing, stock consumption, preparation tracking */
    CHEF,

    /** Warehouse/inventory — stock receiving, transfers, barcode scanning, stock counts */
    WAREHOUSE,

    /** Financial operations — cash register, expense entry, daily reconciliation */
    ACCOUNTANT,

    /** External financial advisor — read-only access to financial reports, tax summaries */
    FINANCIAL_ADVISOR
}
