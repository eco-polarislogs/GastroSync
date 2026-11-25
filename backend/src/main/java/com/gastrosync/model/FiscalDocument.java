package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Adisyona bagli mali belge.
 *  E_ARSIV  - e-Arsiv fatura (UBL-TR 1.2 XML burada uretilir; GIB'e gonderim ozel entegrator uzerinden)
 *  E_ADISYON- e-Adisyon (entegrator baglandiginda)
 *  OKC      - Yeni nesil yazar kasada (OKC) kesilen fisin numarasi adisyona baglanir (mutabakat icin)
 * Kayit silinmez; iptal durum degisikligi ile yapilir.
 */
@Entity
@Table(name = "fiscal_documents",
        uniqueConstraints = @UniqueConstraint(name = "uk_fiscal_document_no", columnNames = "document_no"),
        indexes = {
                @Index(name = "idx_fiscal_check", columnList = "check_id"),
                @Index(name = "idx_fiscal_created", columnList = "created_at")
        })
public class FiscalDocument {

    public static final String E_ARSIV = "E_ARSIV";
    public static final String E_ADISYON = "E_ADISYON";
    public static final String OKC = "OKC";

    public static final String DRAFT = "DRAFT";          // XML uretildi, entegrator tanimli degil
    public static final String SENT = "SENT";            // entegratore gonderildi
    public static final String ACCEPTED = "ACCEPTED";    // entegrator / GIB kabul etti
    public static final String ERROR = "ERROR";
    public static final String RECORDED = "RECORDED";    // OKC fis numarasi kaydedildi
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "check_id", nullable = false)
    private Long checkId;

    @Column(name = "check_no", nullable = false, length = 40)
    private String checkNo;

    @Column(nullable = false, length = 12)
    private String type;

    @Column(nullable = false, length = 12)
    private String status;

    /** ETTN (UUID) */
    @Column(length = 36)
    private String uuid;

    /** e-Arsiv: 3 harf + yil + 9 hane (16 karakter). OKC: fis numarasi */
    @Column(name = "document_no", length = 40)
    private String documentNo;

    @Column(name = "okc_z_no", length = 20)
    private String okcZNo;

    @Column(name = "buyer_name", length = 200)
    private String buyerName;

    /** VKN (10) veya TCKN (11) */
    @Column(name = "buyer_tax_id", length = 11)
    private String buyerTaxId;

    @Column(name = "buyer_tax_office", length = 100)
    private String buyerTaxOffice;

    @Column(name = "buyer_email", length = 150)
    private String buyerEmail;

    @Column(precision = 14, scale = 2)
    private BigDecimal total;

    @Column(name = "vat_total", precision = 14, scale = 2)
    private BigDecimal vatTotal;

    @Column(columnDefinition = "TEXT")
    private String xml;

    @Column(length = 30)
    private String provider;

    @Column(name = "provider_ref", length = 120)
    private String providerRef;

    @Column(length = 500)
    private String error;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "cancel_reason", length = 300)
    private String cancelReason;

    public Long getId() { return id; }
    public Long getCheckId() { return checkId; }
    public void setCheckId(Long checkId) { this.checkId = checkId; }
    public String getCheckNo() { return checkNo; }
    public void setCheckNo(String checkNo) { this.checkNo = checkNo; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public String getDocumentNo() { return documentNo; }
    public void setDocumentNo(String documentNo) { this.documentNo = documentNo; }
    public String getOkcZNo() { return okcZNo; }
    public void setOkcZNo(String okcZNo) { this.okcZNo = okcZNo; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public String getBuyerTaxId() { return buyerTaxId; }
    public void setBuyerTaxId(String buyerTaxId) { this.buyerTaxId = buyerTaxId; }
    public String getBuyerTaxOffice() { return buyerTaxOffice; }
    public void setBuyerTaxOffice(String buyerTaxOffice) { this.buyerTaxOffice = buyerTaxOffice; }
    public String getBuyerEmail() { return buyerEmail; }
    public void setBuyerEmail(String buyerEmail) { this.buyerEmail = buyerEmail; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public BigDecimal getVatTotal() { return vatTotal; }
    public void setVatTotal(BigDecimal vatTotal) { this.vatTotal = vatTotal; }
    public String getXml() { return xml; }
    public void setXml(String xml) { this.xml = xml; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getProviderRef() { return providerRef; }
    public void setProviderRef(String providerRef) { this.providerRef = providerRef; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
}
