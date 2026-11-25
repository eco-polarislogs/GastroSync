package com.gastrosync.security;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Rol ve kanal yetki politikasinin TEK kaynagi.
 * REST, WebSocket abonelikleri ve bildirim hedefleme ayni kurallari kullanir.
 */
public final class AppRoles {

    public static final String ADMIN = "ADMIN";
    public static final String MANAGER = "MANAGER";
    public static final String CHEF = "CHEF";
    public static final String WAREHOUSE = "WAREHOUSE";
    public static final String ACCOUNTANT = "ACCOUNTANT";
    public static final String FINANCIAL_ADVISOR = "FINANCIAL_ADVISOR";
    /** Kasa sorumlusu: masalar, adisyon, tahsilat ve gun sonu kasa sayimi */
    public static final String CASHIER = "CASHIER";

    public static final Set<String> ALL = Set.of(ADMIN, MANAGER, CHEF, WAREHOUSE, ACCOUNTANT, FINANCIAL_ADVISOR, CASHIER);
    /** Masa / adisyon / tahsilat yetkilileri */
    public static final Set<String> POS = Set.of(ADMIN, MANAGER, CASHIER);
    /** Tum bildirimleri (salt okunur) izleyebilen gozetim rolu: yalnizca Yonetici */
    public static final Set<String> SUPERVISORS = Set.of(ADMIN);
    /** Mali verilere (gelir, gider, defter) erisebilen roller */
    public static final Set<String> FINANCE = Set.of(ADMIN, MANAGER, ACCOUNTANT, FINANCIAL_ADVISOR);

    /** Ekip sohbet kanallari ve erisebilen roller */
    public static final Map<String, Set<String>> CHAT_CHANNELS;

    static {
        Map<String, Set<String>> channels = new LinkedHashMap<>();
        channels.put("general", ALL);
        channels.put("shift", Set.of(ADMIN, MANAGER, CHEF, WAREHOUSE, ACCOUNTANT, CASHIER));
        channels.put("kitchen", Set.of(ADMIN, MANAGER, CHEF, WAREHOUSE, CASHIER));
        channels.put("warehouse", Set.of(ADMIN, MANAGER, CHEF, WAREHOUSE, ACCOUNTANT));
        channels.put("cashier", Set.of(ADMIN, MANAGER, ACCOUNTANT, FINANCIAL_ADVISOR, CASHIER));
        channels.put("management", Set.of(ADMIN, MANAGER, ACCOUNTANT, FINANCIAL_ADVISOR));
        CHAT_CHANNELS = java.util.Collections.unmodifiableMap(channels);
    }

    private AppRoles() {}

    public static String normalize(String role) {
        if (role == null) return null;
        String r = role.trim().toUpperCase(Locale.ROOT);
        return r.startsWith("ROLE_") ? r.substring(5) : r;
    }

    public static boolean isValid(String role) {
        String r = normalize(role);
        return r != null && ALL.contains(r);
    }

    public static boolean canAccessChannel(String role, String channelId) {
        String r = normalize(role);
        if (channelId == null || r == null) return false;
        Set<String> allowed = CHAT_CHANNELS.get(channelId.trim().toLowerCase(Locale.ROOT));
        return allowed != null && allowed.contains(r);
    }

    public static List<String> accessibleChannels(String role) {
        String r = normalize(role);
        if (r == null) return List.of();
        return CHAT_CHANNELS.entrySet().stream()
                .filter(e -> e.getValue().contains(r))
                .map(Map.Entry::getKey)
                .toList();
    }

    /**
     * STOMP abonelik yetkisi. Tanimlanmamis tum hedefler reddedilir (varsayilan: kapali).
     */
    public static boolean canSubscribe(String role, String destination) {
        String r = normalize(role);
        if (destination == null || r == null || !ALL.contains(r)) return false;

        if (destination.startsWith("/user/queue/")) return true;
        if (destination.equals("/topic/notifications")) return true;
        if (destination.equals("/topic/inventory")) return true;
        if (destination.equals("/topic/finance")) return FINANCE.contains(r);
        // Recete / menu fiyati degisikligi (yalnizca tur + kimlik yayinlanir)
        if (destination.equals("/topic/recipes")) {
            return Permissions.has(r, Permissions.P.RECIPE_VIEW) || Permissions.has(r, Permissions.P.POS_VIEW);
        }
        if (destination.equals("/topic/users")) return Permissions.has(r, Permissions.P.USER_MANAGE);
        // Onay talepleri: talep acabilen (Kasiyer, Depo) ve karar verebilen (Mudur) roller; yalnizca tur + kimlik yayinlanir
        if (destination.equals("/topic/approvals")) {
            return Permissions.has(r, Permissions.P.POS_OPERATE) || Permissions.has(r, Permissions.P.INVENTORY_COUNT)
                    || Permissions.has(r, Permissions.P.POS_CANCEL_APPROVE) || Permissions.has(r, Permissions.P.POS_DISCOUNT_APPROVE)
                    || Permissions.has(r, Permissions.P.INVENTORY_ADJUST_APPROVE);
        }
        if (destination.equals("/topic/notifications/supervisors")) return SUPERVISORS.contains(r);
        if (destination.startsWith("/topic/notifications/")) {
            String target = destination.substring("/topic/notifications/".length());
            return r.equalsIgnoreCase(target);
        }
        if (destination.startsWith("/topic/chat/")) {
            return canAccessChannel(r, destination.substring("/topic/chat/".length()));
        }
        if (destination.startsWith("/topic/kitchen")) return Set.of(MANAGER, CHEF, CASHIER).contains(r);
        if (destination.startsWith("/topic/tables")) return Set.of(ADMIN, MANAGER, CASHIER, CHEF).contains(r);
        if (destination.startsWith("/topic/print")) return Set.of(ADMIN, MANAGER, CASHIER, CHEF).contains(r);
        if (destination.startsWith("/topic/warehouse")) return Set.of(MANAGER, CHEF, WAREHOUSE).contains(r);
        if (destination.startsWith("/topic/management")) return FINANCE.contains(r);
        return false;
    }
}
