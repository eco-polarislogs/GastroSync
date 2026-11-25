package com.gastrosync.security;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Date;

import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

/**
 * HMAC-SHA256 imzali JWT uretimi ve dogrulamasi.
 *
 * Anahtar GASTROSYNC_JWT_SECRET ortam degiskeninden okunur (Base64 veya duz metin, >= 32 bayt).
 * Uretim (prod) profilinde anahtar yoksa uygulama BASLAMAZ. Gelistirmede yoksa gecici,
 * rastgele bir anahtar uretilir (yeniden baslatmada oturumlar duser).
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);
    private static final int MIN_KEY_BYTES = 32;

    private final SecretKey signingKey;
    private final long expirationMs;
    private final String issuer;

    public JwtTokenProvider(
            @Value("${gastrosync.jwt.secret:}") String secret,
            @Value("${gastrosync.jwt.expiration-ms:43200000}") long expirationMs,
            @Value("${gastrosync.jwt.issuer:GastroSync-ERP}") String issuer,
            Environment environment) {
        byte[] keyBytes = resolveKey(secret);
        if (keyBytes == null) {
            boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
            if (prod) {
                throw new IllegalStateException(
                        "GASTROSYNC_JWT_SECRET tanimli degil veya 32 bayttan kisa. Uretim ortaminda zorunludur.");
            }
            keyBytes = new byte[64];
            new SecureRandom().nextBytes(keyBytes);
            log.warn("GASTROSYNC_JWT_SECRET tanimli degil: gelistirme icin gecici JWT anahtari uretildi. "
                    + "Uygulama yeniden basladiginda tum oturumlar gecersiz olur.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
        this.issuer = issuer;
    }

    private static byte[] resolveKey(String secret) {
        if (secret == null || secret.isBlank()) return null;
        String s = secret.trim();
        try {
            byte[] decoded = Decoders.BASE64.decode(s);
            if (decoded.length >= MIN_KEY_BYTES) return decoded;
        } catch (RuntimeException ignored) {
            // Base64 degil: duz metin olarak dene
        }
        byte[] raw = s.getBytes(StandardCharsets.UTF_8);
        return raw.length >= MIN_KEY_BYTES ? raw : null;
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public String generateToken(Long userId, String username, String role, String name) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("userId", userId)
                .claim("name", name)
                .issuer(issuer)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException ex) {
            log.debug("JWT suresi dolmus: {}", ex.getClaims().getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Gecersiz JWT: {}", ex.getMessage());
        }
        return false;
    }

    public String getUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public String getRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public Long getUserId(String token) {
        Object v = parseClaims(token).get("userId");
        return v instanceof Number n ? n.longValue() : null;
    }

    public Date getIssuedAt(String token) {
        return parseClaims(token).getIssuedAt();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
