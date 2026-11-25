package com.gastrosync.service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Gider turleri, varsayilan KDV oranlari ve Tekduzen Hesap Plani (TDHP) eslestirmesi.
 *
 * ONEMLI: Hesap kodlari onerilen varsayilanlardir. Resmi defterde kullanilacak nihai hesap,
 * isletmenin hesap planina gore Mali Musavirin takdirindedir.
 */
public final class ExpenseCatalog {

    public record ExpenseType(String code, String label, String defaultCategory, BigDecimal defaultVat,
                              String accountCode, String accountName, boolean profitAndLoss) {}

    private static final Map<String, ExpenseType> TYPES = new LinkedHashMap<>();

    static {
        add("RENT", "Kira (Isyeri)", "FIXED", "0", "770", "Genel Yonetim Giderleri", true);
        add("LABOR", "Iscilik & Maaslar", "FIXED", "0", "770", "Genel Yonetim Giderleri", true);
        add("ACCOUNTANT", "Mali Musavirlik", "FIXED", "20", "770", "Genel Yonetim Giderleri", true);
        add("ELECTRICITY", "Elektrik", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("WATER", "Su", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("GAS", "Dogalgaz", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("PHONE", "Telefon", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("INTERNET", "Internet & Ag", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("SGK", "SGK Isveren Primi", "VARIABLE", "0", "770", "Genel Yonetim Giderleri", true);
        add("CONSUMABLES", "Sarf Malzeme", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("RENOVATION", "Tadilat & Bakim", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
        add("LOGISTICS", "Lojistik & Nakliye", "VARIABLE", "20", "760", "Pazarlama Satis ve Dagitim Giderleri", true);
        add("MARKETING", "Reklam & Tanitim", "VARIABLE", "20", "760", "Pazarlama Satis ve Dagitim Giderleri", true);
        // Vergi odemeleri (KDV, gecici vergi, stopaj) bir borcun kapatilmasidir; faaliyet gideri degildir
        add("TAX", "Vergi Tahakkuk / Odemesi", "VARIABLE", "0", "360", "Odenecek Vergi ve Fonlar", false);
        // Hammadde alimi stok (varlik) artisidir; gider, tuketildikce SMM (620) olarak taninir
        add("RAW_MATERIAL", "Hammadde / Gida Alimi", "VARIABLE", "1", "150", "Ilk Madde ve Malzeme", false);
        add("FOOD_SUPPLY", "Gida Tedarik Alimi", "VARIABLE", "1", "150", "Ilk Madde ve Malzeme", false);
        add("OTHER", "Diger Giderler", "VARIABLE", "20", "770", "Genel Yonetim Giderleri", true);
    }

    private ExpenseCatalog() {}

    private static void add(String code, String label, String cat, String vat, String acc, String accName, boolean pnl) {
        TYPES.put(code, new ExpenseType(code, label, cat, new BigDecimal(vat), acc, accName, pnl));
    }

    public static ExpenseType require(String code) {
        ExpenseType t = code == null ? null : TYPES.get(code.trim().toUpperCase(Locale.ROOT));
        if (t == null) {
            throw new IllegalArgumentException("Gecersiz gider turu: " + code + ". Gecerli turler: " + String.join(", ", TYPES.keySet()));
        }
        return t;
    }

    public static ExpenseType find(String code) {
        ExpenseType t = code == null ? null : TYPES.get(code.trim().toUpperCase(Locale.ROOT));
        return t != null ? t : TYPES.get("OTHER");
    }

    public static Map<String, ExpenseType> all() {
        return TYPES;
    }

    public static boolean isInventoryPurchase(String subType) {
        String s = subType == null ? "" : subType.toUpperCase(Locale.ROOT);
        return "RAW_MATERIAL".equals(s) || "FOOD_SUPPLY".equals(s);
    }
}
