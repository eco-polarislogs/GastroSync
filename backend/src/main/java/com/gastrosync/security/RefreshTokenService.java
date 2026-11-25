package com.gastrosync.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.gastrosync.model.AppUser;
import com.gastrosync.model.RefreshToken;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.repository.RefreshTokenRepository;
import com.gastrosync.service.AuditService;

/**
 * Yenileme token'i yasam dongusu (OWASP JWT / Session Management onerileri):
 *  - Erisim token'i kisa omurludur (varsayilan 15 dk); oturum yenileme token'i ile surdurulur.
 *  - Yenileme token'i opak ve rastgeledir; veritabaninda yalnizca SHA-256 ozeti tutulur.
 *  - Her kullanimda dondurulur. Iptal edilmis token tekrar gelirse (calinti suphesi) tum cihaz oturumu iptal edilir.
 *    Ayni anda iki sekmenin yenilemesi (yaris) icin kisa bir tolerans penceresi vardir.
 *  - Cikis, sifre degisikligi / sifirlama, rol degisikligi, hesabin pasife alinmasi ve "tum cihazlardan cik"
 *    yenileme token'larini iptal eder.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    /** Dondurulmus token'in es zamanli ikinci kullanimina izin verilen sure (sn) */
    private static final long ROTATION_GRACE_SECONDS = 20;

    private final RefreshTokenRepository repository;
    private final AppUserRepository userRepository;
    private final AuditService auditService;
    private final long refreshDays;
    private final long sessionMaxDays;

    public RefreshTokenService(RefreshTokenRepository repository, AppUserRepository userRepository, AuditService auditService,
                               @Value("${gastrosync.jwt.refresh-expiration-days:7}") long refreshDays,
                               @Value("${gastrosync.jwt.session-max-days:30}") long sessionMaxDays) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.refreshDays = Math.max(1, refreshDays);
        this.sessionMaxDays = Math.max(this.refreshDays, sessionMaxDays);
    }

    public record Issued(String token, LocalDateTime expiresAt) {}

    public record Rotation(AppUser user, Issued issued) {}

    /** Yeni giris: yeni cihaz oturumu (aile) */
    @Transactional
    public Issued issueForLogin(AppUser user) {
        LocalDateTime now = LocalDateTime.now();
        return issue(user, UUID.randomUUID().toString(), now, now);
    }

    /**
     * Token'i dondurur. Gecersiz, suresi dolmus, iptal edilmis (ve tolerans disi) token icin
     * InvalidRefreshTokenException firlatir (istemci giris ekranina doner).
     */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 200) {
            throw new InvalidRefreshTokenException("Oturum yenileme bilgisi eksik");
        }
        RefreshToken t = repository.findByHashForUpdate(hash(rawToken.trim()))
                .orElseThrow(() -> new InvalidRefreshTokenException("Oturum bulunamadi; lutfen yeniden giris yapin"));
        LocalDateTime now = LocalDateTime.now();

        if (t.isRevoked()) {
            boolean benignRace = RefreshToken.ROTATED.equals(t.getRevokeReason())
                    && t.getRevokedAt().plusSeconds(ROTATION_GRACE_SECONDS).isAfter(now);
            if (!benignRace) {
                if (RefreshToken.ROTATED.equals(t.getRevokeReason())) {
                    int n = repository.revokeFamily(t.getFamilyId(), now, RefreshToken.REUSE_DETECTED);
                    auditService.logIndependent(t.getUsername(), null, "REFRESH_TOKEN_REUSE", "USER", t.getUserId(),
                            "Kullanilmis yenileme token'i tekrar sunuldu; cihaz oturumu iptal edildi (" + n + " token). Cihaz: "
                                    + t.getDevice() + " | IP: " + AuditService.currentIp());
                    log.warn("Yenileme token'i tekrar kullanimi: kullanici={}, aile={}", t.getUsername(), t.getFamilyId());
                }
                throw new InvalidRefreshTokenException("Oturum sonlandirilmis; lutfen yeniden giris yapin");
            }
        }
        if (t.getExpiresAt().isBefore(now)) {
            throw new InvalidRefreshTokenException("Oturum suresi doldu; lutfen yeniden giris yapin");
        }
        if (t.getFamilyStartedAt().plusDays(sessionMaxDays).isBefore(now)) {
            repository.revokeFamily(t.getFamilyId(), now, "MAX_AGE");
            throw new InvalidRefreshTokenException("Guvenlik geregi " + sessionMaxDays + " gunde bir yeniden giris gerekir");
        }
        AppUser user = userRepository.findByUsernameIgnoreCase(t.getUsername()).orElse(null);
        if (user == null || !user.isActive() || !AppRoles.isValid(user.getRole())) {
            repository.revokeFamily(t.getFamilyId(), now, "USER_DISABLED");
            throw new InvalidRefreshTokenException("Hesap kullanima kapali");
        }
        LocalDateTime cutoff = latest(user.getPasswordChangedAt(), user.getSessionsRevokedAt());
        if (cutoff != null && t.getCreatedAt().truncatedTo(ChronoUnit.SECONDS).isBefore(cutoff.truncatedTo(ChronoUnit.SECONDS))) {
            repository.revokeFamily(t.getFamilyId(), now, RefreshToken.SESSIONS_REVOKED);
            throw new InvalidRefreshTokenException("Oturumlariniz sonlandirildi; lutfen yeniden giris yapin");
        }
        if (!t.isRevoked()) {
            t.setRevokedAt(now);
            t.setRevokeReason(RefreshToken.ROTATED);
            repository.save(t);
        }
        return new Rotation(user, issue(user, t.getFamilyId(), t.getFamilyStartedAt(), now));
    }

    /** Cikis: bu cihaz oturumunu (aileyi) iptal eder. Gecersiz token sessizce yok sayilir. */
    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 200) return;
        repository.findByTokenHash(hash(rawToken.trim())).ifPresent(t -> {
            repository.revokeFamily(t.getFamilyId(), LocalDateTime.now(), RefreshToken.LOGOUT);
            auditService.logIndependent(t.getUsername(), null, "LOGOUT", "USER", t.getUserId(), "Cihaz: " + t.getDevice());
        });
    }

    /** Kullanicinin tum cihaz oturumlari (sifre / rol degisikligi, pasife alma, tum cihazlardan cikis) */
    @Transactional(propagation = Propagation.REQUIRED)
    public int revokeAllForUser(String username, String reason) {
        if (username == null) return 0;
        return repository.revokeAllForUser(username, LocalDateTime.now(), reason);
    }

    @Transactional(readOnly = true)
    public List<RefreshToken> activeSessions(String username) {
        return repository.findByUsernameIgnoreCaseAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(username, LocalDateTime.now());
    }

    public long refreshExpirationSeconds() {
        return refreshDays * 86400L;
    }

    private Issued issue(AppUser user, String familyId, LocalDateTime familyStartedAt, LocalDateTime now) {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        LocalDateTime expires = now.plusDays(refreshDays);
        LocalDateTime absolute = familyStartedAt.plusDays(sessionMaxDays);
        if (expires.isAfter(absolute)) expires = absolute;

        RefreshToken t = new RefreshToken();
        t.setTokenHash(hash(raw));
        t.setUsername(user.getUsername());
        t.setUserId(user.getId());
        t.setFamilyId(familyId);
        t.setFamilyStartedAt(familyStartedAt);
        t.setCreatedAt(now);
        t.setExpiresAt(expires);
        t.setDevice(truncate(currentUserAgent(), 120));
        t.setIp(truncate(AuditService.currentIp(), 64));
        repository.save(t);
        // Bir gunden uzun suredir suresi dolmus kayitlari temizle (tablo buyumesin)
        repository.deleteExpiredBefore(now.minusDays(1));
        return new Issued(raw, expires);
    }

    static String hash(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 bulunamadi", e);
        }
    }

    private static LocalDateTime latest(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static String currentUserAgent() {
        try {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                String ua = attrs.getRequest().getHeader("User-Agent");
                return ua == null || ua.isBlank() ? "Bilinmeyen cihaz" : ua;
            }
        } catch (RuntimeException ignored) {
            // istek baglami yok (test / zamanlanmis is)
        }
        return "Bilinmeyen cihaz";
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    /** Epoch saniyesi (istemci tarafinda saat dilimi belirsizligi olmasin) */
    public static long epochSeconds(LocalDateTime t) {
        return t.atZone(ZoneId.systemDefault()).toEpochSecond();
    }
}
