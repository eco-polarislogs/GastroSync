package com.gastrosync.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Metot guvenligi icin izin denetimi: {@code @PreAuthorize("@perm.can('EXPENSE_APPROVE')")}.
 * Rol bilgisi oturumdaki ROLE_ yetkisinden (her istekte veritabanindan cozulen) alinir.
 */
@Component("perm")
public class PermissionGuard {

    /** Oturum sahibinin rolu verilen izinlerden EN AZ BIRINE sahip mi */
    public boolean can(String... permissions) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            String authority = ga.getAuthority();
            if (authority == null || !authority.startsWith("ROLE_")) continue;
            for (String p : permissions) {
                if (Permissions.has(authority, p)) return true;
            }
        }
        return false;
    }

    public boolean can(Permissions.P permission) {
        return can(permission.name());
    }

    /** Servis katmaninda zorunlu izin kontrolu */
    public void require(Permissions.P permission, String message) {
        if (!can(permission)) throw new AccessDeniedException(message);
    }
}
