package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title; // Örn: Restoran Kirası, Elektrik Faturası

    @Column(nullable = false)
    private String category; // FIXED (Sabit) veya VARIABLE (Değişken)

    @Column(nullable = false)
    private String subType; 
    // Sabit: RENT (Kira), LABOR (İşçilik), ACCOUNTANT (Mali Müşavir)
    // Değişken: ELECTRICITY (Elektrik), WATER (Su), GAS (Doğalgaz), PHONE (Telefon), INTERNET (İnternet), TAX (Vergi), SGK (Sigorta SGK), CONSUMABLES (Sarf Malzeme)

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    private String period; // Örn: "2026-10" (Ekim 2026)

    private LocalDate expenseDate;

    private String recordedBy;

    private String note;

    // Muhasebe & Kasa & Mali Müşavir Entegrasyon Alanları
    private Boolean isOwnedProperty = false; // Dükkan mülk sahibi mi yoksa kira mı?
    private Boolean paidByCashier = true;     // Muhasebeci / Kasa tarafından fiilen ödendi mi?
    private Boolean recordedInLedger = false; // Mali Müşavir tarafından resmi deftere işlendi mi?
    private Boolean sentToAdvisor = false;    // Muhasebe tarafından Mali Müşavir onayına gönderildi mi?
    private String status = "PENDING_APPROVAL"; // PENDING_APPROVAL, SENT_TO_ADVISOR, APPROVED_IN_LEDGER, REJECTED
    
    // Gerçekçi Muhasebe & Borç/Vade & Müşavir Ret Yönetimi Alanları
    private String paymentStatus = "PAID"; // PAID (Ödendi), UNPAID (Ödenmedi/Borçta), PARTIAL (Kısmi Ödendi)
    private String rejectionReason; // Mali müşavir reddederse yazacağı gerekçe (örn: "Fatura aslı eksik", "Stopaj oranı hatalı")
    private LocalDate dueDate; // Son ödeme vadesi (borç/vade takibi için)
    private String invoiceNumber; // Resmi Fatura / Fiş / Dekont No
    private String counterparty; // Alacaklı / Tedarikçi / Kurum (örn: "Enerjisa", "İSKİ", "Mal Sahibi Mehmet Bey")

    public Expense() {}

    public Expense(String title, String category, String subType, BigDecimal amount, String period, LocalDate expenseDate, String recordedBy, String note) {
        this.title = title;
        this.category = category;
        this.subType = subType;
        this.amount = amount;
        this.period = period;
        this.expenseDate = expenseDate != null ? expenseDate : LocalDate.now();
        this.recordedBy = recordedBy;
        this.note = note;
        this.isOwnedProperty = false;
        this.paidByCashier = true;
        this.recordedInLedger = false;
    }

    public Expense(String title, String category, String subType, BigDecimal amount, String period, LocalDate expenseDate, String recordedBy, String note, Boolean isOwnedProperty, Boolean paidByCashier, Boolean recordedInLedger) {
        this.title = title;
        this.category = category;
        this.subType = subType;
        this.amount = amount;
        this.period = period;
        this.expenseDate = expenseDate != null ? expenseDate : LocalDate.now();
        this.recordedBy = recordedBy;
        this.note = note;
        this.isOwnedProperty = isOwnedProperty != null ? isOwnedProperty : false;
        this.paidByCashier = paidByCashier != null ? paidByCashier : true;
        this.recordedInLedger = recordedInLedger != null ? recordedInLedger : false;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSubType() { return subType; }
    public void setSubType(String subType) { this.subType = subType; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }

    public LocalDate getExpenseDate() { return expenseDate; }
    public void setExpenseDate(LocalDate expenseDate) { this.expenseDate = expenseDate; }

    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Boolean getIsOwnedProperty() { return isOwnedProperty; }
    public void setIsOwnedProperty(Boolean isOwnedProperty) { this.isOwnedProperty = isOwnedProperty; }

    public Boolean getPaidByCashier() { return paidByCashier; }
    public void setPaidByCashier(Boolean paidByCashier) { this.paidByCashier = paidByCashier; }

    public Boolean getRecordedInLedger() { return recordedInLedger; }
    public void setRecordedInLedger(Boolean recordedInLedger) { this.recordedInLedger = recordedInLedger; }

    public Boolean getSentToAdvisor() { return sentToAdvisor; }
    public void setSentToAdvisor(Boolean sentToAdvisor) { this.sentToAdvisor = sentToAdvisor; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getCounterparty() { return counterparty; }
    public void setCounterparty(String counterparty) { this.counterparty = counterparty; }
}
