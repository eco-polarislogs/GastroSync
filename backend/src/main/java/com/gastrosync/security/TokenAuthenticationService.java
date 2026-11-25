package com.gastrosync.security;

import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;

/**
 * JWT'yi dogrular ve oturum sahibini VERITABANINDAN cozer.
 * HTTP filtresi ve WebSocket CONNECT ayni kurallari kullanir:
 *  - imza / sure / issuer gecerli olmali
 *  - kullanici silinmemis ve aktif olmali
 *  - token, son sifre degisikliginden SONRA uretilmis olmali
 *  - rol tokendan degil, guncel kullanici kaydindan alinir
 */
@Service
public class TokenAuthenticationService {

    private final JwtTokenProvider jwtTokenProvider;
    private final AppUserRepository userRepository;

    public TokenAuthenticationService(JwtTokenProvider jwtTokenProvider, AppUserRepository userRepository) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userRepository = userRepository;
    }

    public Optional<ResolvedSession> resolve(String token) {
        if (token == null || token.isBlank() || !jwtTokenProvider.validateToken(token)) {
            return Optional.empty();
        }
        String username = jwtTokenProvider.getUsername(token);
        Optional<AppUser> userOpt = userRepository.findByUsernameIgnoreCase(username);
        if (userOpt.isEmpty()) return Optional.empty();
        AppUser user = userOpt.get();
        if (!user.isActive()) return Optional.empty();

        Date issuedAt = jwtTokenProvider.getIssuedAt(token);
        if (user.getPasswordChangedAt() != null && issuedAt != null) {
            Date changed = Date.from(user.getPasswordChangedAt().truncatedTo(ChronoUnit.SECONDS)
                    .atZone(ZoneId.systemDefault()).toInstant());
            if (issuedAt.before(changed)) {
                return Optional.empty();
            }
        }
        if (user.getSessionsRevokedAt() != null && issuedAt != null) {
            Date revoked = Date.from(user.getSessionsRevokedAt().truncatedTo(ChronoUnit.SECONDS)
                    .atZone(ZoneId.systemDefault()).toInstant());
            if (issuedAt.before(revoked)) {
                return Optional.empty();
            }
        }
        String role = AppRoles.normalize(user.getRole());
        if (!AppRoles.isValid(role)) return Optional.empty();
        return Optional.of(new ResolvedSession(
                new AuthenticatedUser(user.getId(), user.getUsername(), user.getName(), role),
                user.isMustChangePassword()));
    }

    public record ResolvedSession(AuthenticatedUser user, boolean mustChangePassword) {}
}
