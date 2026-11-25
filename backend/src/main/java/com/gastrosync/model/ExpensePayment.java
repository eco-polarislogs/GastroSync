package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Bir gidere yapilan fiili odeme (kasa / banka cikisi). Kismi odemeler desteklenir.
 * Odemeler silinmez; kasa mutabakatinda nakit cikislari buradan hesaplanir.
 */
@Entity
@Table(
    name = "expense_payments",
    indexes = {
        @Index(name = "idx_expense_payments_expense", columnList = "expenseId"),
        @Index(name = "idx_expense_payments_date", columnList = "paymentDate")
    }
)
public class ExpensePayment {

    public static final String CASH = "CASH";
    public static final String BANK_TRANSFER = "BANK_TRANSFER";
    public static final String CREDIT_CARD = "CREDIT_CARD";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long expenseId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 30)
    private String method;

    @Column(nullable = false)
    private LocalDate paymentDate;

    @Column(nullable = false, length = 100)
    private String paidBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 500)
    private String note;

    public ExpensePayment() {}

    public ExpensePayment(Long expenseId, BigDecimal amount, String method, String paidBy, String note) {
        this.expenseId = expenseId;
        this.amount = amount;
        this.method = method;
        this.paidBy = paidBy;
        this.note = note;
        this.paymentDate = LocalDate.now();
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getExpenseId() { return expenseId; }
    public BigDecimal getAmount() { return amount; }
    public String getMethod() { return method; }
    public LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDate paymentDate) { this.paymentDate = paymentDate; }
    public String getPaidBy() { return paidBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getNote() { return note; }
}
