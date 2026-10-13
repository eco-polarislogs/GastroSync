package com.gastrosync.model;

import jakarta.persistence.*;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private String contactPerson;
    private String phone;
    private String email;
    private String address;
    private String taxNumber;
    private Integer paymentTermDays; // Vade günü (örn. 30 gün)

    public Supplier() {}

    public Supplier(String name, String contactPerson, String phone, String email, String address, String taxNumber, Integer paymentTermDays) {
        this.name = name;
        this.contactPerson = contactPerson;
        this.phone = phone;
        this.email = email;
        this.address = address;
        this.taxNumber = taxNumber;
        this.paymentTermDays = paymentTermDays;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getTaxNumber() { return taxNumber; }
    public void setTaxNumber(String taxNumber) { this.taxNumber = taxNumber; }

    public Integer getPaymentTermDays() { return paymentTermDays; }
    public void setPaymentTermDays(Integer paymentTermDays) { this.paymentTermDays = paymentTermDays; }
}
