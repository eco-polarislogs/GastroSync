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
 * Gun sonu kasa sayimi / mutabakat tutanagi. Beklenen nakit sistemden hesaplanir,
 * sayilan nakit kasiyer tarafindan girilir; fark (acik/fazla) degistirilemez sekilde kaydedilir.
 */
@Entity
@Table(name = "cash_closings", indexes = @Index(name = "idx_cash_closings_date", columnList = "businessDate"))
public class CashClosing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate businessDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal openingFloat;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cashSales;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cashPaidOut;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal expectedCash;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal countedCash;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal difference;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cardSales;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal mealCardSales;

    @Column(nullable = false, length = 100)
    private String closedBy;

    @Column(nullable = false)
    private LocalDateTime closedAt;

    @Column(length = 1000)
    private String note;

    /** Kasiyer sayar (PENDING_REVIEW) -> Muhasebe mutabakat yapar (RECONCILED) veya yeniden sayim ister (REJECTED) */
    public static final String PENDING_REVIEW = "PENDING_REVIEW";
    public static final String RECONCILED = "RECONCILED";
    public static final String REJECTED = "REJECTED";

    @Column(length = 20)
    private String status;

    @Column(length = 100)
    private String reviewedBy;

    private LocalDateTime reviewedAt;

    @Column(length = 500)
    private String reviewNote;

    public CashClosing() {}

    /** Eski (onay akisi oncesi) tutanaklar mutabakatli sayilir */
    public String getStatus() { return status == null ? RECONCILED : status; }
    public void setStatus(String status) { this.status = status; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }

    public Long getId() { return id; }
    public LocalDate getBusinessDate() { return businessDate; }
    public void setBusinessDate(LocalDate businessDate) { this.businessDate = businessDate; }
    public BigDecimal getOpeningFloat() { return openingFloat; }
    public void setOpeningFloat(BigDecimal openingFloat) { this.openingFloat = openingFloat; }
    public BigDecimal getCashSales() { return cashSales; }
    public void setCashSales(BigDecimal cashSales) { this.cashSales = cashSales; }
    public BigDecimal getCashPaidOut() { return cashPaidOut; }
    public void setCashPaidOut(BigDecimal cashPaidOut) { this.cashPaidOut = cashPaidOut; }
    public BigDecimal getExpectedCash() { return expectedCash; }
    public void setExpectedCash(BigDecimal expectedCash) { this.expectedCash = expectedCash; }
    public BigDecimal getCountedCash() { return countedCash; }
    public void setCountedCash(BigDecimal countedCash) { this.countedCash = countedCash; }
    public BigDecimal getDifference() { return difference; }
    public void setDifference(BigDecimal difference) { this.difference = difference; }
    public BigDecimal getCardSales() { return cardSales; }
    public void setCardSales(BigDecimal cardSales) { this.cardSales = cardSales; }
    public BigDecimal getMealCardSales() { return mealCardSales; }
    public void setMealCardSales(BigDecimal mealCardSales) { this.mealCardSales = mealCardSales; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
