package com.gastrosync.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Fis yazicisi (ESC/POS, ag uzerinden ham TCP, genelde port 9100).
 * station: KITCHEN (mutfak siparis fisi) · BAR (icecek siparis fisi) · RECEIPT (adisyon dokumu ve bilgi fisi)
 * connection:
 *   DIRECT - sunucu yaziciya kendisi baglanir (sunucu restoranin yerel aginda / VPN'de calisiyorsa)
 *   BRIDGE - bulut kurulumu: restorandaki "yazici koprusu" Android cihazi isleri alip yerel agdaki yaziciya iletir
 */
@Entity
@Table(name = "printers")
public class Printer {

    public static final String KITCHEN = "KITCHEN";
    public static final String BAR = "BAR";
    public static final String RECEIPT = "RECEIPT";
    public static final String DIRECT = "DIRECT";
    public static final String BRIDGE = "BRIDGE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 20)
    private String station = KITCHEN;

    @Column(nullable = false, length = 120)
    private String host;

    @Column(nullable = false)
    private Integer port = 9100;

    @Column(nullable = false, length = 10)
    private String connection = DIRECT;

    /** Satir basina karakter: 58 mm kagit 32, 80 mm kagit 48 */
    @Column(name = "chars_per_line", nullable = false)
    private Integer charsPerLine = 48;

    @Column(nullable = false)
    private Boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getStation() { return station; }
    public void setStation(String station) { this.station = station; }
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }
    public String getConnection() { return connection; }
    public void setConnection(String connection) { this.connection = connection; }
    public Integer getCharsPerLine() { return charsPerLine; }
    public void setCharsPerLine(Integer charsPerLine) { this.charsPerLine = charsPerLine; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
