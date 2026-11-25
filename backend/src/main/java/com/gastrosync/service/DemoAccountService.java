package com.gastrosync.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.AppRoles;

/**
 * Demo / tanıtım modu hızlı giriş listesi.
 *
 * YALNIZCA gastrosync.seed.demo-data=true iken çalışır; canlı (prod) profilde liste her zaman boştur.
 * Yalnızca veritabanında gerçekten var olan, aktif ve şifresi bilinen demo şifresiyle eşleşen
 * hesaplar döndürülür; böylece web ve mobildeki demo düğmeleri her zaman çalışan hesapları gösterir.
 */
@Service
public class DemoAccountService {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountService.class);
    public static final String DEMO_PASSWORD = "123456";

    /** Standart demo hesapları + eski sürümlerden kalan demo hesapları */
    public static final List<String[]> CANDIDATES = List.of(
            new String[]{"admin", DEMO_PASSWORD},
            new String[]{"manager", DEMO_PASSWORD},
            new String[]{"accountant", DEMO_PASSWORD},
            new String[]{"advisor", DEMO_PASSWORD},
            new String[]{"chef", DEMO_PASSWORD},
            new String[]{"warehouse", DEMO_PASSWORD},
            new String[]{"cashier", DEMO_PASSWORD},
            new String[]{"muhasebe", "muhasebe123"},
            new String[]{"malimusavir", "musavir123"});

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean demoMode;

    private volatile List<Map<String, Object>> cache = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    public DemoAccountService(AppUserRepository userRepository, PasswordEncoder passwordEncoder,
                              @Value("${gastrosync.seed.demo-data:false}") boolean demoMode) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.demoMode = demoMode;
    }

    public boolean isDemoMode() {
        return demoMode;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        if (!demoMode) return List.of();
        if (Instant.now().isBefore(cachedAt.plusSeconds(60))) return cache;
        List<Map<String, Object>> out = new ArrayList<>();
        for (String[] c : CANDIDATES) {
            AppUser u = userRepository.findByUsernameIgnoreCase(c[0]).orElse(null);
            if (u == null || !u.isActive() || u.getPassword() == null) continue;
            if (!passwordEncoder.matches(c[1], u.getPassword())) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("username", u.getUsername());
            row.put("password", c[1]);
            row.put("name", u.getName());
            row.put("role", AppRoles.normalize(u.getRole()));
            out.add(row);
        }
        cache = List.copyOf(out);
        cachedAt = Instant.now();
        return cache;
    }

    public void invalidate() {
        cachedAt = Instant.EPOCH;
    }

    public void warnIfEnabled() {
        if (demoMode) {
            log.warn("DEMO MODU ACIK: demo hesaplari ve sifreleri giris ekraninda listelenir. "
                    + "Canli ortamda GASTROSYNC_SEED_DEMO_DATA=false kullanin.");
        }
    }
}
