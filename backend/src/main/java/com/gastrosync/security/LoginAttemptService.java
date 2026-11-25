package com.gastrosync.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Kaba kuvvet (brute-force) korumasi: ayni kullanici adi veya IP icin ardisik hatali
 * giris denemelerinden sonra gecici kilit uygular.
 *
 * Not: Bellek ici tutulur; birden fazla backend ornegi calistirilacaksa paylasimli
 * bir depoya (Redis vb.) tasinmalidir.
 */
@Service
public class LoginAttemptService {

    private final int maxAttempts;
    private final Duration lockout;
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public LoginAttemptService(
            @Value("${gastrosync.security.max-login-attempts:5}") int maxAttempts,
            @Value("${gastrosync.security.lockout-minutes:5}") int lockoutMinutes) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.lockout = Duration.ofMinutes(Math.max(1, lockoutMinutes));
    }

    private static String key(String kind, String value) {
        return kind + ":" + (value == null ? "" : value.trim().toLowerCase(Locale.ROOT));
    }

    /** Kilitliyse kalan sure (saniye), degilse 0 */
    public long secondsUntilUnlock(String identifier, String ip) {
        return remaining(key("user", identifier));
    }

    private long remaining(String k) {
        Attempt a = attempts.get(k);
        if (a == null || a.lockedUntil == null) return 0;
        long secs = Duration.between(Instant.now(), a.lockedUntil).getSeconds();
        if (secs <= 0) {
            attempts.remove(k);
            return 0;
        }
        return secs;
    }

    public void recordFailure(String identifier, String ip) {
        // Yalnizca kullanici adi bazli kilit: ayni restoran agindaki (ortak IP) diger personel etkilenmez
        bump(key("user", identifier), maxAttempts);
    }

    private void bump(String k, int threshold) {
        attempts.compute(k, (kk, a) -> {
            Attempt next = a == null ? new Attempt() : a;
            if (next.lockedUntil != null && Instant.now().isAfter(next.lockedUntil)) {
                next = new Attempt();
            }
            next.count++;
            if (next.count >= threshold) {
                next.lockedUntil = Instant.now().plus(lockout);
            }
            return next;
        });
    }

    public void recordSuccess(String identifier, String ip) {
        attempts.remove(key("user", identifier));
    }

    private static final class Attempt {
        int count;
        Instant lockedUntil;
    }
}
