package com.gastrosync.security;

import java.util.Optional;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.gastrosync.repository.AppUserRepository;

/**
 * Islemi yapan kisinin kimligini HER ZAMAN guvenlik baglamindan (JWT) alir.
 * Istek govdesindeki "recordedBy", "sender" gibi alanlara asla guvenilmez.
 */
@Service
public class CurrentUserService {

    public static final String SYSTEM = "SYSTEM";

    private final AppUserRepository userRepository;

    public CurrentUserService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Optional<AuthenticatedUser> current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        if (auth.getPrincipal() instanceof AuthenticatedUser au) {
            return Optional.of(au);
        }
        // Test / alternatif kimlik dogrulama (orn. @WithMockUser)
        String username = auth.getName();
        String role = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(AppRoles::normalize)
                .findFirst()
                .orElse(null);
        return Optional.of(userRepository.findByUsernameIgnoreCase(username)
                .map(u -> new AuthenticatedUser(u.getId(), u.getUsername(), u.getName(), role != null ? role : AppRoles.normalize(u.getRole())))
                .orElse(new AuthenticatedUser(null, username, username, role)));
    }

    public AuthenticatedUser require() {
        return current().orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Oturum bulunamadi"));
    }

    public String username() {
        return current().map(AuthenticatedUser::username).orElse(SYSTEM);
    }

    public String displayName() {
        return current().map(AuthenticatedUser::displayName).orElse("Sistem");
    }

    public String role() {
        return current().map(AuthenticatedUser::role).orElse(SYSTEM);
    }

    /** Oturum sahibinin rolu verilen izne sahip mi (Permissions tablosu) */
    public boolean can(Permissions.P permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (ga.getAuthority() != null && ga.getAuthority().startsWith("ROLE_")
                    && Permissions.has(ga.getAuthority(), permission)) {
                return true;
            }
        }
        return false;
    }

    /** Coklu rol iceren test kimlikleri dahil, kullanicinin verilen role sahip olup olmadigini kontrol eder */
    public boolean hasAnyRole(String... roles) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            String r = AppRoles.normalize(ga.getAuthority());
            for (String wanted : roles) {
                if (wanted.equalsIgnoreCase(r)) return true;
            }
        }
        return false;
    }
}
