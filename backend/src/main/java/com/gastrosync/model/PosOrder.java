package com.gastrosync.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pos_orders")
public class PosOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String orderNumber;

    @Column(nullable = false)
    private String tableNumber;

    @Column(nullable = false)
    private String status; // OPEN, COMPLETED, CANCELLED

    @Column(nullable = false)
    private String paymentMethod; // CASH, CREDIT_CARD, MEAL_CARD

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subTotal;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCost; // Reçetelerden otomatik toplanan gıda maliyeti

    private LocalDateTime createdAt;
    private LocalDateTime closedAt;

    public PosOrder() {
        this.createdAt = LocalDateTime.now();
        this.status = "OPEN";
        this.subTotal = BigDecimal.ZERO;
        this.taxAmount = BigDecimal.ZERO;
        this.totalAmount = BigDecimal.ZERO;
        this.totalCost = BigDecimal.ZERO;
    }

    public PosOrder(String orderNumber, String tableNumber, String paymentMethod, 
                    BigDecimal subTotal, BigDecimal taxAmount, BigDecimal totalAmount, BigDecimal totalCost) {
        this.orderNumber = orderNumber;
        this.tableNumber = tableNumber;
        this.status = "COMPLETED";
        this.paymentMethod = paymentMethod;
        this.subTotal = subTotal;
        this.taxAmount = taxAmount;
        this.totalAmount = totalAmount;
        this.totalCost = totalCost;
        this.createdAt = LocalDateTime.now().minusHours(1);
        this.closedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getTableNumber() { return tableNumber; }
    public void setTableNumber(String tableNumber) { this.tableNumber = tableNumber; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public BigDecimal getSubTotal() { return subTotal; }
    public void setSubTotal(BigDecimal subTotal) { this.subTotal = subTotal; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getTotalCost() { return totalCost; }
    public void setTotalCost(BigDecimal totalCost) { this.totalCost = totalCost; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }

    public BigDecimal getFoodCostRatio() {
        if (totalAmount != null && totalAmount.compareTo(BigDecimal.ZERO) > 0 && totalCost != null) {
            return totalCost.divide(totalAmount, 4, java.math.RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        }
        return BigDecimal.ZERO;
    }
}
