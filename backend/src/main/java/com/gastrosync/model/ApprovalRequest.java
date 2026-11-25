package com.gastrosync.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Roller arasi onay talebi (yonetici onayi / "manager override").
 *
 * Personel kendi yetkisini asan bir islemi dogrudan yapamaz; gerekcesiyle talep acar, yetkili rol
 * (Isletme Muduru) onaylar veya gerekceli reddeder. Onaylanan islem sunucuda, talebi acanin adina
 * ve onaylayanin imzasiyla uygulanir. Talep acan kisi kendi talebini onaylayamaz (maker-checker).
 *
 *   ITEM_VOID     Kasiyer  -> Mudur : hazirlanmaya baslamis / servis edilmis kalemin iptali
 *   CHECK_VOID    Kasiyer  -> Mudur : hazirlanmis kalem iceren adisyonun iptali
 *   COMP          Kasiyer  -> Mudur : kalemi ikram etme (ucretsiz; stok yine duser)
 *   DISCOUNT      Kasiyer  -> Mudur : adisyona yuzde / tutar indirimi
 *   STOCK_ADJUST  Depo     -> Mudur : esigi asan sayim farkinin stoga islenmesi
 */
@Entity
@Table(name = "approval_requests", indexes = {
        @Index(name = "idx_approval_status", columnList = "status"),
        @Index(name = "idx_approval_requested_by", columnList = "requestedBy"),
        @Index(name = "idx_approval_target", columnList = "targetType,targetId"),
        @Index(name = "idx_approval_check", columnList = "checkId")
})
public class ApprovalRequest {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String WITHDRAWN = "WITHDRAWN";
    /** Hedef kayit karar verilmeden kapandi / degisti (or. adisyon odendi) */
    public static final String EXPIRED = "EXPIRED";

    public static final String ITEM_VOID = "ITEM_VOID";
    public static final String CHECK_VOID = "CHECK_VOID";
    public static final String COMP = "COMP";
    public static final String DISCOUNT = "DISCOUNT";
    public static final String STOCK_ADJUST = "STOCK_ADJUST";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 12)
    private String status = PENDING;

    /** CHECK_ITEM, CHECK, INVENTORY_ITEM */
    @Column(nullable = false, length = 20)
    private String targetType;

    @Column(nullable = false)
    private Long targetId;

    private Long checkId;

    private Integer tableNumber;

    /** Okunabilir ozet: "Masa 5 | Adana Kebap x2" */
    @Column(nullable = false, length = 250)
    private String summary;

    /** Indirim tutari / ikram degeri / sayim farkinin TL karsiligi */
    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    /** Yuzde indirim */
    @Column(precision = 5, scale = 2)
    private BigDecimal percent;

    /** Sayim: sayilan miktar */
    @Column(precision = 12, scale = 3)
    private BigDecimal quantity;

    /** Sayim: sayim anindaki sistem stoku (fark onayda bu farka gore uygulanir) */
    @Column(precision = 12, scale = 3)
    private BigDecimal systemQuantity;

    @Column(length = 20)
    private String unit;

    @Column(nullable = false, length = 300)
    private String reason;

    /** Karar verebilecek izin (Permissions.P adi) */
    @Column(nullable = false, length = 40)
    private String approverPermission;

    @Column(nullable = false, length = 100)
    private String requestedBy;

    @Column(length = 100)
    private String requestedByName;

    @Column(length = 30)
    private String requestedRole;

    private LocalDateTime requestedAt;

    @Column(length = 100)
    private String decidedBy;

    @Column(length = 100)
    private String decidedByName;

    private LocalDateTime decidedAt;

    @Column(length = 300)
    private String decisionNote;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        if (requestedAt == null) requestedAt = LocalDateTime.now();
        if (status == null) status = PENDING;
    }

    public ApprovalRequest() {}

    public boolean isPending() { return PENDING.equals(status); }

    public Long getId() { return id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public Long getCheckId() { return checkId; }
    public void setCheckId(Long checkId) { this.checkId = checkId; }
    public Integer getTableNumber() { return tableNumber; }
    public void setTableNumber(Integer tableNumber) { this.tableNumber = tableNumber; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getPercent() { return percent; }
    public void setPercent(BigDecimal percent) { this.percent = percent; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getSystemQuantity() { return systemQuantity; }
    public void setSystemQuantity(BigDecimal systemQuantity) { this.systemQuantity = systemQuantity; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getApproverPermission() { return approverPermission; }
    public void setApproverPermission(String approverPermission) { this.approverPermission = approverPermission; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public String getRequestedByName() { return requestedByName; }
    public void setRequestedByName(String requestedByName) { this.requestedByName = requestedByName; }
    public String getRequestedRole() { return requestedRole; }
    public void setRequestedRole(String requestedRole) { this.requestedRole = requestedRole; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
    public String getDecidedBy() { return decidedBy; }
    public void setDecidedBy(String decidedBy) { this.decidedBy = decidedBy; }
    public String getDecidedByName() { return decidedByName; }
    public void setDecidedByName(String decidedByName) { this.decidedByName = decidedByName; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String decisionNote) { this.decisionNote = decisionNote; }
    public Long getVersion() { return version; }
}
