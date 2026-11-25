package com.gastrosync.security;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rol -> izin -> ekran matrisinin TEK kaynagi.
 *
 * Ilke: her rol yalnizca KENDI isini yapar (gorevler ayriligi: yetkilendirme, kayit ve varlik muhafazasi
 * ayri kisilerdedir). Roller arasi etkilesim yalnizca gonderme / onaylama / reddetme adimlariyla olur:
 *
 *   Kasiyer      adisyon, tahsilat, gun sonu kasa sayimi ............ -> Muhasebe mutabakati
 *   Kasiyer      hazirlanmis kalem iptali, ikram, indirim talebi ..... -> Mudur onayi / reddi
 *   Depo         esigi asan sayim farki .............................. -> Mudur onayi / reddi
 *   Sef / Depo   tedarik talebi ...................................... -> Mudur harcama onayi
 *   Muhasebe     fatura / kira / fatura kaydi, odeme, belge gonderimi  -> Mudur onayi, Mali Musavir defter onayi
 *   Mudur        harcama onayi, iptal / ikram / indirim / sayim farki onayi, menu fiyati, masa duzeni
 *   Mali Musavir gonderilen belgeyi deftere isler / gerekceli reddeder, donem kapatir
 *   Yonetici     personel ve rol yonetimi, denetim izi, masa duzeni; diger raporlari SALT OKUNUR izler
 *
 * Masa duzeni (ekleme / bolum / kapasite / kullanim disi) isletmeye gore degisir; Kasiyer, Mudur ve
 * Yonetici yapabilir. Bu bir kontrol adimi degildir (para / onay akisi icermez).
 *
 * REST (@PreAuthorize("@perm.can('...')")), servis kurallari, /api/auth/me yaniti ve istemci menuleri
 * bu tabloyu kullanir. Istemciler kendi yetki tablosu tutmaz.
 */
public final class Permissions {

    public enum P {
        // Personel & sistem
        USER_MANAGE, AUDIT_VIEW, ANNOUNCE,
        // Panolar & raporlar
        DASHBOARD_VIEW, FINANCE_SUMMARY_VIEW, VAT_REPORT_VIEW, JOURNAL_VIEW, CASH_REPORT_VIEW, ZREPORT_VIEW,
        // Gider / fatura
        EXPENSE_VIEW, EXPENSE_CREATE, EXPENSE_EDIT, EXPENSE_DELETE, EXPENSE_APPROVE, EXPENSE_PAY, EXPENSE_SUBMIT,
        LEDGER_DECIDE, PERIOD_VIEW, PERIOD_MANAGE, PURCHASE_REQUEST,
        // Kasa
        CASH_CLOSING_VIEW, CASH_CLOSING_CREATE, CASH_CLOSING_REVIEW,
        // Satis & masa
        SALES_VIEW, SALES_VOID, POS_VIEW, POS_OPERATE, POS_TABLE_MANAGE, POS_CANCEL_APPROVE, POS_DISCOUNT_APPROVE,
        KITCHEN_VIEW, KITCHEN_OPERATE,
        // Recete & fiyat
        RECIPE_VIEW, RECIPE_EDIT, MENU_PRICE_SET, PRICING_VIEW, PRICING_FINANCIALS,
        // Stok
        INVENTORY_VIEW, INVENTORY_ITEM_MANAGE, INVENTORY_RECEIVE, INVENTORY_WASTE, INVENTORY_COUNT,
        INVENTORY_COST_EDIT, INVENTORY_VALUATION, DELIVERY_VIEW, INVENTORY_ADJUST_APPROVE
    }

    /** Izinlerin Turkce aciklamasi (personel ekraninda yoneticiye gosterilir) */
    public static final Map<P, String> LABELS;

    /** Rol -> izinler */
    public static final Map<String, Set<P>> ROLE_PERMISSIONS;

    /** Rol -> menu ekranlari (sirali; ilki varsayilan acilis ekrani) */
    public static final Map<String, List<String>> ROLE_SCREENS;

    /** Rol gorev tanimi (personel kaydinda yoneticiye gosterilir) */
    public static final Map<String, String> ROLE_DESCRIPTIONS;

    public static final Map<String, String> ROLE_LABELS;

    static {
        Map<P, String> l = new LinkedHashMap<>();
        l.put(P.USER_MANAGE, "Personel hesabı açma, rol atama, şifre sıfırlama");
        l.put(P.AUDIT_VIEW, "Denetim izini görüntüleme");
        l.put(P.ANNOUNCE, "Ekibe duyuru gönderme");
        l.put(P.DASHBOARD_VIEW, "Yönetim panosu");
        l.put(P.FINANCE_SUMMARY_VIEW, "Gelir-gider özeti");
        l.put(P.VAT_REPORT_VIEW, "KDV özeti");
        l.put(P.JOURNAL_VIEW, "Yevmiye fiş dökümü");
        l.put(P.CASH_REPORT_VIEW, "Günlük / aylık / yıllık kasa raporu");
        l.put(P.ZREPORT_VIEW, "Gün sonu Z özeti");
        l.put(P.EXPENSE_VIEW, "Gider ve faturaları görüntüleme");
        l.put(P.EXPENSE_CREATE, "Fatura, kira ve gider kaydı");
        l.put(P.EXPENSE_EDIT, "Gider kaydını düzeltme");
        l.put(P.EXPENSE_DELETE, "Ödenmemiş taslak gideri silme");
        l.put(P.EXPENSE_APPROVE, "Harcama onayı / onay aşamasında ret");
        l.put(P.EXPENSE_PAY, "Ödeme kaydı (kasa / banka)");
        l.put(P.EXPENSE_SUBMIT, "Faturalandırıp Mali Müşavire gönderme");
        l.put(P.LEDGER_DECIDE, "Gönderilen belgeyi deftere işleme / gerekçeli ret");
        l.put(P.PERIOD_VIEW, "Muhasebe dönemlerini görüntüleme");
        l.put(P.PERIOD_MANAGE, "Dönem kapama / yeniden açma");
        l.put(P.PURCHASE_REQUEST, "Tedarik talebi açma");
        l.put(P.CASH_CLOSING_VIEW, "Kasa sayım tutanaklarını görüntüleme");
        l.put(P.CASH_CLOSING_CREATE, "Gün sonu kasa sayımı");
        l.put(P.CASH_CLOSING_REVIEW, "Kasa sayımı mutabakatı (onay / ret)");
        l.put(P.SALES_VIEW, "Satış kayıtlarını görüntüleme");
        l.put(P.SALES_VOID, "Satış iptali (gerekçeli)");
        l.put(P.POS_VIEW, "Masa durumunu görüntüleme");
        l.put(P.POS_OPERATE, "Adisyon açma, sipariş, tahsilat");
        l.put(P.POS_TABLE_MANAGE, "Masa ekleme / düzenleme");
        l.put(P.POS_CANCEL_APPROVE, "Hazırlanan kalem / adisyon iptali ve iptal talebi onayı");
        l.put(P.POS_DISCOUNT_APPROVE, "İkram ve indirim onayı");
        l.put(P.KITCHEN_VIEW, "Mutfak ekranını görüntüleme");
        l.put(P.KITCHEN_OPERATE, "Sipariş hazırlama durumu");
        l.put(P.RECIPE_VIEW, "Reçeteleri görüntüleme");
        l.put(P.RECIPE_EDIT, "Reçete ve gramaj oluşturma / düzeltme");
        l.put(P.MENU_PRICE_SET, "Menü satış fiyatı / KDV belirleme");
        l.put(P.PRICING_VIEW, "Menü & maliyet analizi");
        l.put(P.PRICING_FINANCIALS, "Genel gider payı ve başabaş fiyatı");
        l.put(P.INVENTORY_VIEW, "Stok listesini görüntüleme");
        l.put(P.INVENTORY_ITEM_MANAGE, "Stok kartı ekleme / düzenleme");
        l.put(P.INVENTORY_RECEIVE, "Mal kabul");
        l.put(P.INVENTORY_WASTE, "Fire kaydı");
        l.put(P.INVENTORY_COUNT, "Sayım düzeltmesi");
        l.put(P.INVENTORY_COST_EDIT, "Birim maliyet düzeltmesi");
        l.put(P.INVENTORY_VALUATION, "Stok değerleme raporu");
        l.put(P.DELIVERY_VIEW, "Bekleyen teslimatlar");
        l.put(P.INVENTORY_ADJUST_APPROVE, "Eşiği aşan sayım farkı onayı");
        LABELS = Collections.unmodifiableMap(l);

        Map<String, Set<P>> rp = new LinkedHashMap<>();
        rp.put(AppRoles.ADMIN, EnumSet.of(
                P.USER_MANAGE, P.AUDIT_VIEW, P.ANNOUNCE,
                P.DASHBOARD_VIEW, P.FINANCE_SUMMARY_VIEW, P.VAT_REPORT_VIEW, P.JOURNAL_VIEW, P.CASH_REPORT_VIEW, P.ZREPORT_VIEW,
                P.EXPENSE_VIEW, P.PERIOD_VIEW, P.CASH_CLOSING_VIEW, P.SALES_VIEW, P.POS_VIEW, P.POS_TABLE_MANAGE,
                P.RECIPE_VIEW, P.PRICING_VIEW, P.PRICING_FINANCIALS,
                P.INVENTORY_VIEW, P.INVENTORY_VALUATION));
        rp.put(AppRoles.MANAGER, EnumSet.of(
                P.ANNOUNCE, P.DASHBOARD_VIEW, P.FINANCE_SUMMARY_VIEW, P.CASH_REPORT_VIEW, P.ZREPORT_VIEW,
                P.EXPENSE_VIEW, P.EXPENSE_APPROVE, P.PERIOD_VIEW, P.CASH_CLOSING_VIEW,
                P.SALES_VIEW, P.SALES_VOID, P.POS_VIEW, P.POS_TABLE_MANAGE, P.POS_CANCEL_APPROVE, P.POS_DISCOUNT_APPROVE, P.KITCHEN_VIEW,
                P.RECIPE_VIEW, P.MENU_PRICE_SET, P.PRICING_VIEW, P.PRICING_FINANCIALS,
                P.INVENTORY_VIEW, P.INVENTORY_VALUATION, P.DELIVERY_VIEW, P.INVENTORY_ADJUST_APPROVE));
        rp.put(AppRoles.ACCOUNTANT, EnumSet.of(
                P.FINANCE_SUMMARY_VIEW, P.VAT_REPORT_VIEW, P.JOURNAL_VIEW, P.CASH_REPORT_VIEW, P.ZREPORT_VIEW,
                P.EXPENSE_VIEW, P.EXPENSE_CREATE, P.EXPENSE_EDIT, P.EXPENSE_DELETE, P.EXPENSE_PAY, P.EXPENSE_SUBMIT,
                P.PERIOD_VIEW, P.CASH_CLOSING_VIEW, P.CASH_CLOSING_REVIEW, P.SALES_VIEW,
                P.RECIPE_VIEW, P.PRICING_VIEW, P.PRICING_FINANCIALS,
                P.INVENTORY_VIEW, P.INVENTORY_COST_EDIT, P.INVENTORY_VALUATION, P.DELIVERY_VIEW));
        rp.put(AppRoles.FINANCIAL_ADVISOR, EnumSet.of(
                P.AUDIT_VIEW, P.FINANCE_SUMMARY_VIEW, P.VAT_REPORT_VIEW, P.JOURNAL_VIEW, P.CASH_REPORT_VIEW, P.ZREPORT_VIEW,
                P.EXPENSE_VIEW, P.LEDGER_DECIDE, P.PERIOD_VIEW, P.PERIOD_MANAGE, P.CASH_CLOSING_VIEW,
                P.INVENTORY_VALUATION));
        rp.put(AppRoles.CASHIER, EnumSet.of(
                P.ZREPORT_VIEW, P.CASH_CLOSING_VIEW, P.CASH_CLOSING_CREATE, P.POS_VIEW, P.POS_OPERATE, P.POS_TABLE_MANAGE));
        rp.put(AppRoles.CHEF, EnumSet.of(
                P.KITCHEN_VIEW, P.KITCHEN_OPERATE, P.RECIPE_VIEW, P.RECIPE_EDIT, P.PRICING_VIEW,
                P.INVENTORY_VIEW, P.INVENTORY_WASTE, P.PURCHASE_REQUEST, P.DELIVERY_VIEW));
        rp.put(AppRoles.WAREHOUSE, EnumSet.of(
                P.INVENTORY_VIEW, P.INVENTORY_ITEM_MANAGE, P.INVENTORY_RECEIVE, P.INVENTORY_WASTE, P.INVENTORY_COUNT,
                P.PURCHASE_REQUEST, P.DELIVERY_VIEW));
        rp.replaceAll((k, v) -> Collections.unmodifiableSet(v));
        ROLE_PERMISSIONS = Collections.unmodifiableMap(rp);

        Map<String, List<String>> rs = new LinkedHashMap<>();
        rs.put(AppRoles.ADMIN, List.of("dashboard", "users", "pos", "audit", "sales", "accounting", "inventory", "recipes", "pricing"));
        rs.put(AppRoles.MANAGER, List.of("dashboard", "approvals", "pos", "kitchen", "sales", "inventory", "recipes", "pricing"));
        rs.put(AppRoles.ACCOUNTANT, List.of("accounting", "sales", "inventory", "pricing"));
        rs.put(AppRoles.FINANCIAL_ADVISOR, List.of("advisor-ledger", "audit"));
        rs.put(AppRoles.CASHIER, List.of("pos"));
        rs.put(AppRoles.CHEF, List.of("kitchen", "recipes", "inventory", "pricing"));
        rs.put(AppRoles.WAREHOUSE, List.of("warehouse", "inventory"));
        ROLE_SCREENS = Collections.unmodifiableMap(rs);

        Map<String, String> rl = new LinkedHashMap<>();
        rl.put(AppRoles.ADMIN, "Yönetici");
        rl.put(AppRoles.MANAGER, "İşletme Müdürü");
        rl.put(AppRoles.ACCOUNTANT, "Muhasebe");
        rl.put(AppRoles.FINANCIAL_ADVISOR, "Mali Müşavir (SMMM)");
        rl.put(AppRoles.CASHIER, "Kasiyer");
        rl.put(AppRoles.CHEF, "Mutfak Şefi");
        rl.put(AppRoles.WAREHOUSE, "Depo Sorumlusu");
        ROLE_LABELS = Collections.unmodifiableMap(rl);

        Map<String, String> rd = new LinkedHashMap<>();
        // Gorev tanimlari: restoran is ilanlari (kariyer.net / eleman.net), 3568 sayili Kanun md. 2/A ve
        // restoran ic kontrol ilkeleri (gorevler ayriligi, kor kasa sayimi, iptalde ikinci goz) esas alinmistir.
        rd.put(AppRoles.ADMIN, "İşletme sahibi / sistem yöneticisi: personel hesabı açar, rol ve şifre yönetir, masa düzenini kurar; raporları ve denetim izini salt okunur izler, satış iptallerinden haberdar edilir.");
        rd.put(AppRoles.MANAGER, "Günlük operasyonu yönetir: harcama taleplerini, Kasiyerin iptal / ikram / indirim taleplerini ve Depo Sorumlusunun eşiği aşan sayım farklarını onaylar veya gerekçeyle reddeder; satış iptalini yapar, menü fiyatını food cost hedefiyle belirler, masa düzenini kurar; kasa farkı ve kritik stok uyarılarını izler.");
        rd.put(AppRoles.ACCOUNTANT, "Ön muhasebe: alış faturası, kira ve diğer giderleri kaydeder, tedarikçi ödemelerini (kasa / banka / kart) yapar; günlük, aylık ve yıllık kasa raporunu çıkarır, kasiyerin kör sayımını Z özeti ve POS slipleriyle mutabakatlar, belgeleri Mali Müşavire iletir.");
        rd.put(AppRoles.FINANCIAL_ADVISOR, "3568 sayılı Kanun md. 2/A kapsamında Muhasebenin ilettiği belgeleri inceler; deftere işler veya gerekçeyle reddeder, KDV özetini izler, dönemi kapatır. İşletme adına kayıt, ödeme veya düzeltme yapmaz.");
        rd.put(AppRoles.CASHIER, "Adisyon açar, siparişi mutfağa iletir, nakit / kart / yemek kartı tahsilatı alır, masa ekler ve taşır; gün sonunda kasayı kör sayar (beklenen tutarı görmeden). Hazırlanmış kalemin iptali, ikram ve indirim için Müdüre gerekçeli onay talebi gönderir.");
        rd.put(AppRoles.CHEF, "Standart reçete ve gramajları belirler (önerdiği satış fiyatını Müdür onaylar), mutfak ekranından siparişleri hazırlar, fire kaydı ve tedarik talebi girer.");
        rd.put(AppRoles.WAREHOUSE, "Mal kabulünü siparişe göre yapar, stok kartlarını yönetir, sayım ve fire kaydı girer, tedarik talebi açar. Eşiği aşan sayım farkı Müdür onayıyla stoğa işlenir. Ödeme yapmaz (mal kabul ile ödeme farklı kişilerdedir).");
        ROLE_DESCRIPTIONS = Collections.unmodifiableMap(rd);
    }

    private Permissions() {}

    public static boolean has(String role, P permission) {
        String r = AppRoles.normalize(role);
        if (r == null || permission == null) return false;
        Set<P> set = ROLE_PERMISSIONS.get(r);
        return set != null && set.contains(permission);
    }

    public static boolean has(String role, String permission) {
        try {
            return has(role, P.valueOf(permission));
        } catch (IllegalArgumentException | NullPointerException e) {
            return false;
        }
    }

    public static List<String> permissionsOf(String role) {
        Set<P> set = ROLE_PERMISSIONS.get(AppRoles.normalize(role));
        if (set == null) return List.of();
        return set.stream().map(Enum::name).toList();
    }

    public static List<String> screensOf(String role) {
        return ROLE_SCREENS.getOrDefault(AppRoles.normalize(role), List.of());
    }

    /** Izni olan roller (bildirim hedefleme icin) */
    public static List<String> rolesWith(P permission) {
        List<String> out = new ArrayList<>();
        ROLE_PERMISSIONS.forEach((role, set) -> { if (set.contains(permission)) out.add(role); });
        return out;
    }

    /** Yonetici ekrani icin rol katalogu */
    public static List<Map<String, Object>> catalog() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String role : ROLE_SCREENS.keySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("role", role);
            row.put("label", ROLE_LABELS.get(role));
            row.put("description", ROLE_DESCRIPTIONS.get(role));
            row.put("screens", screensOf(role));
            row.put("permissions", ROLE_PERMISSIONS.get(role).stream()
                    .map(p -> Map.of("code", p.name(), "label", LABELS.getOrDefault(p, p.name())))
                    .toList());
            out.add(row);
        }
        return out;
    }
}
