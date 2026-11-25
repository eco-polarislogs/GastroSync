package com.gastrosync.service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.config.WebSocketSessionRegistry;
import com.gastrosync.dto.auth.AuthResponse;
import com.gastrosync.dto.auth.LoginRequest;
import com.gastrosync.dto.user.UserCreateRequest;
import com.gastrosync.dto.user.UserResponse;
import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.exception.TooManyRequestsException;
import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.JwtTokenProvider;
import com.gastrosync.security.LoginAttemptService;
import com.gastrosync.security.PasswordPolicy;

/**
 * Kimlik dogrulama ve personel hesap yonetimi.
 *
 * Kurallar:
 *  - Hatali giris denemeleri sayilir; esik asilinca gecici kilit (429).
 *  - Yonetici tarafindan olusturulan / sifresi sifirlanan hesap ilk giriste sifre degistirmek zorundadir.
 *  - Sistemde en az bir aktif ADMIN kalmak zorundadir; kullanici kendini silemez / pasife alamaz.
 *  - Tum yetki degisiklikleri denetim izine yazilir.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final String GENERIC_LOGIN_ERROR = "Gecersiz kullanici adi/e-posta veya sifre";

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final LoginAttemptService loginAttemptService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final WebSocketSessionRegistry sessionRegistry;
    private final DemoAccountService demoAccountService;
    private final com.gastrosync.security.RefreshTokenService refreshTokenService;
    private final com.gastrosync.service.push.PushService pushService;

    public UserService(AppUserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager,
                       LoginAttemptService loginAttemptService,
                       AuditService auditService,
                       CurrentUserService currentUserService,
                       WebSocketSessionRegistry sessionRegistry,
                       DemoAccountService demoAccountService,
                       com.gastrosync.security.RefreshTokenService refreshTokenService,
                       com.gastrosync.service.push.PushService pushService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.loginAttemptService = loginAttemptService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.sessionRegistry = sessionRegistry;
        this.demoAccountService = demoAccountService;
        this.refreshTokenService = refreshTokenService;
        this.pushService = pushService;
    }

    /**
     * Yetki degisikliginden sonra kullanicinin oturumlarini sonlandirir: yenileme token'lari hemen iptal edilir,
     * canli (WebSocket) baglantilari islem tamamlaninca kapatilir.
     */
    private void dropLiveSessions(String username) {
        refreshTokenService.revokeAllForUser(username, com.gastrosync.model.RefreshToken.SESSIONS_REVOKED);
        // Rolu / hesabi degisen kullanicinin telefonuna eski rolun bildirimleri gitmesin
        pushService.unregisterUser(username);
        NotificationService.afterCommit(() -> sessionRegistry.closeUserSessions(username));
        demoAccountService.invalidate();
    }

    /** Personel listesi acik olan yonetici ekranlari (web / mobil) canli yenilenir */
    private NotificationService notificationService;

    @Autowired
    void setNotificationService(@Lazy NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    private void usersChanged(String type, Long id) {
        if (notificationService != null) notificationService.publish("/topic/users", Map.of("type", type, "id", id));
    }

    // ── Kimlik dogrulama ───────────────────────────────────────

    @Transactional
    public AuthResponse authenticate(LoginRequest request) {
        String identifier = request.getIdentifier() != null ? request.getIdentifier().trim() : "";
        String rawPassword = request.getPassword() != null ? request.getPassword() : "";
        if (identifier.isEmpty() || rawPassword.isEmpty()) {
            throw new IllegalArgumentException("Kullanici adi/e-posta ve sifre zorunludur");
        }
        String ip = AuditService.currentIp();

        long wait = loginAttemptService.secondsUntilUnlock(identifier, ip);
        if (wait > 0) {
            throw new TooManyRequestsException(
                    "Cok fazla hatali giris denemesi. Lutfen " + Math.max(1, (wait + 59) / 60) + " dakika sonra tekrar deneyin.", wait);
        }

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(identifier, rawPassword));
        } catch (DisabledException e) {
            loginAttemptService.recordFailure(identifier, ip);
            auditService.logIndependent(identifier, null, "LOGIN_FAILED", "USER", null, "Pasif hesap ile giris denemesi");
            throw new IllegalArgumentException("Hesabiniz pasif durumdadir. Lutfen yoneticinize basvurun.");
        } catch (BadCredentialsException e) {
            loginAttemptService.recordFailure(identifier, ip);
            auditService.logIndependent(identifier, null, "LOGIN_FAILED", "USER", null, "Hatali kimlik bilgisi");
            throw new IllegalArgumentException(GENERIC_LOGIN_ERROR);
        } catch (AuthenticationException e) {
            loginAttemptService.recordFailure(identifier, ip);
            auditService.logIndependent(identifier, null, "LOGIN_FAILED", "USER", null, "Kimlik dogrulama hatasi");
            throw new IllegalArgumentException(GENERIC_LOGIN_ERROR);
        }

        AppUser user = userRepository.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException(GENERIC_LOGIN_ERROR));
        loginAttemptService.recordSuccess(identifier, ip);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String role = AppRoles.normalize(user.getRole());
        auditService.logIndependent(user.getUsername(), role, "LOGIN_SUCCESS", "USER", user.getId(), null);
        log.info("Kullanici '{}' giris yapti (rol: {})", user.getUsername(), role);
        return buildAuthResponse(user, refreshTokenService.issueForLogin(user));
    }

    private AuthResponse buildAuthResponse(AppUser user, com.gastrosync.security.RefreshTokenService.Issued refresh) {
        String role = AppRoles.normalize(user.getRole());
        String token = jwtTokenProvider.generateToken(user.getId(), user.getUsername(), role, user.getName());
        AuthResponse response = AuthResponse.of(token, user.getId(), user.getUsername(), user.getName(), role,
                user.getEmail(), jwtTokenProvider.getExpirationMs());
        response.setMustChangePassword(user.isMustChangePassword());
        if (refresh != null) {
            response.setRefreshToken(refresh.token());
            response.setRefreshExpiresIn(Math.max(0, java.time.Duration.between(LocalDateTime.now(), refresh.expiresAt()).getSeconds()));
        }
        return response;
    }

    // ── Oturum yenileme / cikis ────────────────────────────────

    /** Yenileme token'ini dondurur ve yeni erisim token'i uretir (rol ve yetkiler veritabanindan okunur) */
    @Transactional(noRollbackFor = com.gastrosync.security.InvalidRefreshTokenException.class)
    public AuthResponse refresh(String refreshToken) {
        com.gastrosync.security.RefreshTokenService.Rotation r = refreshTokenService.rotate(refreshToken);
        return buildAuthResponse(r.user(), r.issued());
    }

    /** Bu cihazdan cikis: yenileme token'i (cihaz oturumu) iptal edilir */
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenService.logout(refreshToken);
    }

    /** Kullanici: tum cihazlardaki oturumlarini sonlandirir (kayip / calinti telefon) */
    @Transactional
    public void revokeMySessions() {
        AuthenticatedUser me = currentUserService.require();
        AppUser user = userRepository.findByUsernameIgnoreCase(me.username())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi"));
        revokeSessionsOf(user);
        auditService.log("SESSIONS_REVOKED", "USER", user.getId(), null, null, "Kullanici tum cihazlardan cikis yapti");
    }

    /** Yonetici: personelin tum oturumlarini sonlandirir (cihaz kaybi, isten ayrilma) */
    @Transactional(rollbackFor = Exception.class)
    public UserResponse revokeSessions(Long id) {
        AppUser user = find(id);
        revokeSessionsOf(user);
        auditService.log("SESSIONS_REVOKED", "USER", user.getId(), null, null,
                user.getUsername() + " kullanicisinin tum cihaz oturumlari yonetici tarafindan sonlandirildi");
        return UserResponse.fromEntity(user);
    }

    private void revokeSessionsOf(AppUser user) {
        // JWT iat saniye hassasiyetinde: bu saniye icinde uretilmis token'lar da gecersiz olsun (+1 sn)
        user.setSessionsRevokedAt(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(1));
        userRepository.save(user);
        dropLiveSessions(user.getUsername());
    }

    /** Hesap silme talebi: Yoneticiye bildirim; Yonetici Personel ekranindan hesabi arsivler (kisisel veri kaldirilir) */
    @Transactional
    public void requestOwnDeletion(String reason) {
        AuthenticatedUser me = currentUserService.require();
        AppUser user = userRepository.findByUsernameIgnoreCase(me.username())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi"));
        String why = reason == null ? "" : reason.trim();
        if (why.length() > 300) why = why.substring(0, 300);
        auditService.log("ACCOUNT_DELETION_REQUESTED", "USER", user.getId(), null, null,
                user.getUsername() + " hesabinin silinmesini talep etti" + (why.isEmpty() ? "" : ": " + why));
        if (notificationService != null) {
            notificationService.notify(List.of(AppRoles.ADMIN), "Hesap Silme Talebi: " + user.getName(),
                    String.format("%s (%s) hesabinin ve kisisel verilerinin silinmesini talep etti.%s Personel ekranindan hesabi arsivleyin (en gec 30 gun).",
                            user.getName(), user.getUsername(), why.isEmpty() ? "" : " Aciklama: " + why),
                    user.getName(), "ACCOUNT_DELETION_REQUEST", user.getId(), "/users", "WARNING");
        }
    }

    /** Kullanicinin acik cihaz oturumlari */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mySessions() {
        AuthenticatedUser me = currentUserService.require();
        return refreshTokenService.activeSessions(me.username()).stream().map(t -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("device", t.getDevice());
            m.put("ip", t.getIp());
            m.put("signedInAt", t.getFamilyStartedAt());
            m.put("lastActiveAt", t.getCreatedAt());
            m.put("expiresAt", t.getExpiresAt());
            return m;
        }).toList();
    }

    /** Kullanici kendi sifresini degistirir; eski oturumlar gecersiz olur, yeni token doner */
    @Transactional
    public AuthResponse changeOwnPassword(String currentPassword, String newPassword) {
        AuthenticatedUser me = currentUserService.require();
        AppUser user = userRepository.findByUsernameIgnoreCase(me.username())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi"));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            auditService.logIndependent(user.getUsername(), me.role(), "PASSWORD_CHANGE_FAILED", "USER", user.getId(), "Mevcut sifre hatali");
            throw new IllegalArgumentException("Mevcut sifreniz hatali");
        }
        PasswordPolicy.validate(newPassword);
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("Yeni sifre mevcut sifre ile ayni olamaz");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        // JWT 'iat' saniye hassasiyetindedir: bu saniyeden once uretilen tum token'lar gecersiz olur
        user.setPasswordChangedAt(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
        userRepository.save(user);
        auditService.log("PASSWORD_CHANGED", "USER", user.getId(), null, null, "Kullanici kendi sifresini degistirdi");
        dropLiveSessions(user.getUsername());
        return buildAuthResponse(user, refreshTokenService.issueForLogin(user));
    }

    // ── Sorgular ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAllByOrderByNameAsc().stream().map(UserResponse::fromEntity).toList();
    }

    /**
     * Personel listesi: arama (ad, kullanici adi, e-posta), rol ve durum filtresi, siralama ve sayfalama.
     * Personel sayisi sinirli oldugundan filtre bellekte uygulanir.
     */
    @Transactional(readOnly = true)
    public com.gastrosync.dto.PageResponse<UserResponse> search(String q, String role, String status, String sort,
                                                                 Integer page, Integer size) {
        String text = q == null ? "" : q.trim().toLowerCase(java.util.Locale.ROOT);
        String wantedRole = role == null || role.isBlank() || "ALL".equalsIgnoreCase(role) ? null : AppRoles.normalize(role);
        String st = status == null ? "" : status.trim().toLowerCase(java.util.Locale.ROOT);
        List<AppUser> all = userRepository.findAll();
        java.util.Map<String, Long> roleCounts = new java.util.LinkedHashMap<>();
        for (String r : com.gastrosync.security.Permissions.ROLE_SCREENS.keySet()) roleCounts.put(r, 0L);
        all.forEach(u -> roleCounts.merge(AppRoles.normalize(u.getRole()), 1L, Long::sum));
        List<AppUser> filtered = all.stream()
                .filter(u -> wantedRole == null || wantedRole.equals(AppRoles.normalize(u.getRole())))
                .filter(u -> switch (st) {
                    case "active" -> u.isActive();
                    case "inactive" -> !u.isActive();
                    default -> true;
                })
                .filter(u -> text.isEmpty()
                        || (u.getName() != null && u.getName().toLowerCase(java.util.Locale.ROOT).contains(text))
                        || u.getUsername().toLowerCase(java.util.Locale.ROOT).contains(text)
                        || (u.getEmail() != null && u.getEmail().toLowerCase(java.util.Locale.ROOT).contains(text)))
                .sorted(userComparator(sort))
                .toList();
        int pageSize = com.gastrosync.dto.PageResponse.clampSize(size);
        int totalPages = Math.max(1, (int) Math.ceil(filtered.size() / (double) pageSize));
        int p = Math.min(com.gastrosync.dto.PageResponse.clampPage(page), totalPages - 1);
        List<UserResponse> content = filtered.stream().skip((long) p * pageSize).limit(pageSize)
                .map(UserResponse::fromEntity).toList();
        java.util.Map<String, Object> meta = new java.util.LinkedHashMap<>();
        meta.put("roleCounts", roleCounts);
        meta.put("activeCount", all.stream().filter(AppUser::isActive).count());
        meta.put("total", all.size());
        return new com.gastrosync.dto.PageResponse<>(content, p, pageSize, filtered.size(), totalPages, meta);
    }

    private static java.util.Comparator<AppUser> userComparator(String sort) {
        String[] parts = (sort == null || sort.isBlank() ? "name,asc" : sort).split(",");
        String field = parts[0].trim();
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());
        java.util.Comparator<String> text = java.util.Comparator.nullsLast(
                java.text.Collator.getInstance(java.util.Locale.forLanguageTag("tr"))::compare);
        java.util.Comparator<AppUser> c = switch (field) {
            case "username" -> java.util.Comparator.comparing(AppUser::getUsername, text);
            case "role" -> java.util.Comparator.comparing((AppUser u) -> AppRoles.normalize(u.getRole()), text);
            case "lastLoginAt" -> java.util.Comparator.comparing(AppUser::getLastLoginAt,
                    java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()));
            case "createdAt" -> java.util.Comparator.comparing(AppUser::getCreatedAt,
                    java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()));
            case "active" -> java.util.Comparator.comparing(AppUser::isActive);
            default -> java.util.Comparator.comparing(AppUser::getName, text);
        };
        return desc ? c.reversed() : c;
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return UserResponse.fromEntity(find(id));
    }

    @Transactional(readOnly = true)
    public UserResponse getUserByUsername(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + username));
        return UserResponse.fromEntity(user);
    }

    private AppUser find(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: ID " + id));
    }

    // ── Yonetim (yalnizca ADMIN) ────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public UserResponse createUser(UserCreateRequest request) {
        String normalizedUsername = request.getUsername().trim().toLowerCase(java.util.Locale.ROOT);
        // Arsivlenmis (isten ayrilmis) personelin kullanici adi da denetim izi icin tekrar verilmez
        if (userRepository.countIncludingArchived(normalizedUsername) > 0) {
            throw new BusinessRuleException("Bu kullanici adi zaten kullanimda (arsivdeki personel dahil): " + normalizedUsername);
        }
        String cleanEmail = request.getEmail() != null && !request.getEmail().isBlank()
                ? request.getEmail().trim().toLowerCase(java.util.Locale.ROOT) : null;
        if (cleanEmail != null && !userRepository.findByEmailIgnoreCase(cleanEmail).isEmpty()) {
            throw new BusinessRuleException("Bu e-posta adresi baska bir personele ait: " + cleanEmail);
        }
        String role = AppRoles.normalize(request.getRole());
        if (!AppRoles.isValid(role)) {
            throw new IllegalArgumentException("Gecersiz rol: " + request.getRole());
        }
        PasswordPolicy.validate(request.getPassword());

        AppUser newUser = new AppUser();
        newUser.setUsername(normalizedUsername);
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setName(request.getName().trim());
        newUser.setRole(role);
        newUser.setEmail(cleanEmail);
        newUser.setActive(true);
        // Yonetici isterse kullanici ilk giriste kendi sifresini belirler; aksi halde verilen bilgilerle dogrudan girer
        newUser.setMustChangePassword(Boolean.TRUE.equals(request.getRequirePasswordChange()));

        AppUser saved = userRepository.save(newUser);
        auditService.log("USER_CREATED", "USER", saved.getId(), null, role,
                "Yeni kullanici: " + saved.getUsername() + " (" + role + ")");
        usersChanged("CREATED", saved.getId());
        return UserResponse.fromEntity(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserResponse updateUserRole(Long id, String newRole) {
        AppUser user = find(id);
        String validatedRole = AppRoles.normalize(newRole);
        if (!AppRoles.isValid(validatedRole)) {
            throw new IllegalArgumentException("Gecersiz rol: " + newRole);
        }
        String oldRole = AppRoles.normalize(user.getRole());
        if (oldRole.equals(validatedRole)) {
            return UserResponse.fromEntity(user);
        }
        if (AppRoles.ADMIN.equals(oldRole) && countActiveAdmins() <= 1) {
            throw new BusinessRuleException("Sistemdeki son aktif yoneticinin rolu degistirilemez");
        }
        user.setRole(validatedRole);
        AppUser updated = userRepository.save(user);
        auditService.log("ROLE_CHANGED", "USER", user.getId(), oldRole, validatedRole,
                user.getUsername() + " rolu degisti: " + oldRole + " -> " + validatedRole);
        dropLiveSessions(user.getUsername());
        usersChanged("ROLE", user.getId());
        return UserResponse.fromEntity(updated);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserResponse setActive(Long id, boolean active) {
        AppUser user = find(id);
        AuthenticatedUser me = currentUserService.require();
        if (user.getUsername().equalsIgnoreCase(me.username()) && !active) {
            throw new BusinessRuleException("Kendi hesabinizi pasife alamazsiniz");
        }
        if (!active && AppRoles.ADMIN.equals(AppRoles.normalize(user.getRole())) && countActiveAdmins() <= 1) {
            throw new BusinessRuleException("Sistemdeki son aktif yonetici pasife alinamaz");
        }
        boolean old = user.isActive();
        user.setActive(active);
        AppUser saved = userRepository.save(user);
        auditService.log(active ? "USER_ACTIVATED" : "USER_DEACTIVATED", "USER", user.getId(),
                String.valueOf(old), String.valueOf(active), user.getUsername());
        if (!active) dropLiveSessions(user.getUsername());
        usersChanged("STATUS", user.getId());
        return UserResponse.fromEntity(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserResponse resetPassword(Long id, String temporaryPassword) {
        AppUser user = find(id);
        PasswordPolicy.validate(temporaryPassword);
        user.setPassword(passwordEncoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        user.setPasswordChangedAt(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
        AppUser saved = userRepository.save(user);
        auditService.log("PASSWORD_RESET", "USER", user.getId(), null, null,
                user.getUsername() + " icin gecici sifre belirlendi (ilk giriste degistirilecek)");
        dropLiveSessions(user.getUsername());
        return UserResponse.fromEntity(saved);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        AppUser user = find(id);
        AuthenticatedUser me = currentUserService.require();
        if (user.getUsername().equalsIgnoreCase(me.username())) {
            throw new BusinessRuleException("Kendi hesabinizi silemezsiniz");
        }
        if (AppRoles.ADMIN.equals(AppRoles.normalize(user.getRole())) && user.isActive() && countActiveAdmins() <= 1) {
            throw new BusinessRuleException("Sistemdeki son aktif yonetici silinemez");
        }
        user.markDeleted(me.username());
        user.setActive(false);
        // KVKK: arsivlenen hesabin kisisel bilgileri kaldirilir; kullanici adi denetim izi butunlugu icin takma ad olarak kalir
        user.setName("Silinmiş kullanıcı #" + user.getId());
        user.setEmail(null);
        user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
        userRepository.save(user);
        userRepository.delete(user);
        auditService.log("USER_DELETED", "USER", id, null, null, "Kullanici arsivlendi: " + user.getUsername());
        dropLiveSessions(user.getUsername());
        usersChanged("DELETED", id);
    }

    /** Yonetici: personelin ad soyad ve e-posta bilgisini duzeltir */
    @Transactional(rollbackFor = Exception.class)
    public UserResponse updateProfile(Long id, String name, String email) {
        AppUser user = find(id);
        String cleanName = name == null ? "" : name.trim();
        if (cleanName.length() < 2 || cleanName.length() > 100) {
            throw new IllegalArgumentException("Ad soyad 2-100 karakter arasinda olmalidir");
        }
        String cleanEmail = email == null || email.isBlank() ? null : email.trim();
        if (cleanEmail != null && !cleanEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("Gecerli bir e-posta adresi giriniz");
        }
        if (cleanEmail != null) {
            userRepository.findByEmailIgnoreCase(cleanEmail).stream()
                    .filter(other -> !other.getId().equals(id))
                    .findFirst()
                    .ifPresent(other -> { throw new BusinessRuleException("Bu e-posta baska bir kullaniciya ait"); });
        }
        String before = user.getName() + " / " + user.getEmail();
        user.setName(cleanName);
        user.setEmail(cleanEmail);
        AppUser saved = userRepository.save(user);
        auditService.log("USER_PROFILE_UPDATED", "USER", id, null, null, before + " -> " + cleanName + " / " + cleanEmail);
        usersChanged("PROFILE", id);
        return UserResponse.fromEntity(saved);
    }

    private long countActiveAdmins() {
        return userRepository.findByRoleIgnoreCase(AppRoles.ADMIN).stream().filter(AppUser::isActive).count();
    }
}
