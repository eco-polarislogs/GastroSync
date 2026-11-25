package com.gastrosync.exception;

/**
 * Is kurali ihlali (HTTP 409 Conflict): orn. kesinlesmis kaydi degistirme, kapali doneme kayit,
 * gorevler ayriligi ihlali, yetersiz stok.
 */
public class BusinessRuleException extends IllegalStateException {
    public BusinessRuleException(String message) {
        super(message);
    }
}
