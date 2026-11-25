package com.gastrosync.service.push;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.gastrosync.model.AppUser;
import com.gastrosync.model.DeviceToken;
import com.gastrosync.model.Notification;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.DeviceTokenRepository;
import com.gastrosync.security.AppRoles;

import jakarta.annotation.PreDestroy;

/**
 * Telefon (push) bildirimleri: uygulama icindeki bildirim merkezine dusen her bildirim, hedef rollerdeki
 * aktif kullanicilarin kayitli cihazlarina da gonderilir. Hedef kullanicilar her gonderimde GUNCEL role gore
 * belirlenir; rolu degisen / pasif kullaniciya gitmez. Gonderim islem tamamlandiktan sonra arka planda yapilir,
 * istek suresini uzatmaz ve push servisi hatasi is akisini etkilemez.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    /** Expo push token bicimi: ExponentPushToken[...] veya ExpoPushToken[...] */
    private static final Pattern EXPO_TOKEN = Pattern.compile("^Expo(nent)?PushToken\\[[A-Za-z0-9_\\-]{10,120}]$");

    private final DeviceTokenRepository deviceRepository;
    private final AppUserRepository userRepository;
    private final PushGateway gateway;
    private final TransactionTemplate tx;
    private final boolean enabled;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "gastrosync-push");
        t.setDaemon(true);
        return t;
    });

    public PushService(DeviceTokenRepository deviceRepository, AppUserRepository userRepository, PushGateway gateway,
                       TransactionTemplate tx, @Value("${gastrosync.push.enabled:true}") boolean enabled) {
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.gateway = gateway;
        this.tx = tx;
        this.enabled = enabled;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    public static boolean isValidToken(String token) {
        return token != null && EXPO_TOKEN.matcher(token.trim()).matches();
    }

    /** Cihazi oturum acan kullaniciya baglar (ayni cihaz baska kullanicidaysa devralinir) */
    @Transactional
    public DeviceToken register(String username, String token, String platform) {
        if (!isValidToken(token)) throw new IllegalArgumentException("Gecersiz push adresi (Expo push token bekleniyor)");
        String t = token.trim();
        DeviceToken d = deviceRepository.findByToken(t).orElseGet(DeviceToken::new);
        if (d.getId() == null) {
            d.setToken(t);
            d.setCreatedAt(LocalDateTime.now());
        }
        d.setUsername(username);
        d.setPlatform(platform == null ? null : platform.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z]", ""));
        d.setLastSeenAt(LocalDateTime.now());
        return deviceRepository.save(d);
    }

    /** Cihazdan cikis: yalnizca kendi cihaz kaydini siler */
    @Transactional
    public void unregister(String username, String token) {
        if (token == null) return;
        deviceRepository.findByToken(token.trim())
                .filter(d -> d.getUsername().equalsIgnoreCase(username))
                .ifPresent(deviceRepository::delete);
    }

    /** Oturumlar sonlandirildiginda (rol / sifre degisikligi, pasife alma) kullanicinin tum cihazlari */
    @Transactional
    public void unregisterUser(String username) {
        if (username != null) deviceRepository.deleteByUsername(username);
    }

    /** Bildirim merkezine dusen bildirimi hedef rollerin cihazlarina gonderir (arka planda) */
    public void dispatch(Notification n) {
        if (!enabled || n == null) return;
        executor.execute(() -> {
            try {
                deliver(n);
            } catch (RuntimeException e) {
                log.warn("Push bildirimi gonderilemedi (#{}): {}", n.getId(), e.getMessage());
            }
        });
    }

    void deliver(Notification n) {
        Set<String> roles = targets(n.getTargetRole());
        List<DeviceToken> devices = tx.execute(status -> {
            List<AppUser> users = roles.contains("ALL")
                    ? userRepository.findAll()
                    : roles.stream().flatMap(r -> userRepository.findByRoleIgnoreCase(r).stream()).toList();
            Set<String> usernames = users.stream()
                    .filter(AppUser::isActive)
                    .filter(u -> roles.contains("ALL") || roles.contains(AppRoles.normalize(u.getRole())))
                    .map(u -> u.getUsername().toLowerCase(Locale.ROOT))
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            return usernames.isEmpty() ? List.of() : deviceRepository.findByUsernamesLower(usernames);
        });
        if (devices == null || devices.isEmpty()) return;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("notificationId", n.getId());
        data.put("type", n.getType());
        if (n.getRoute() != null) data.put("route", n.getRoute());
        if (n.getRelatedEntityId() != null) data.put("entityId", n.getRelatedEntityId());
        String body = n.getMessage() == null ? "" : n.getMessage().length() > 300 ? n.getMessage().substring(0, 297) + "..." : n.getMessage();
        List<PushGateway.PushMessage> messages = new ArrayList<>();
        for (DeviceToken d : devices) messages.add(new PushGateway.PushMessage(d.getToken(), n.getTitle(), body, data));
        List<String> invalid = gateway.send(messages);
        if (invalid != null && !invalid.isEmpty()) {
            tx.executeWithoutResult(status -> deviceRepository.deleteByTokens(invalid));
            log.info("{} gecersiz push adresi silindi", invalid.size());
        }
    }

    private static Set<String> targets(String targetRole) {
        if (targetRole == null || targetRole.isBlank()) return Set.of("ALL");
        return Arrays.stream(targetRole.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
