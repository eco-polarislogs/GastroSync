package com.gastrosync.support;

import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.AuthenticatedUser;
import com.gastrosync.security.JwtTokenProvider;

/** Testlerde gercek kullanici kimligiyle islem yapmak icin yardimci */
public final class TestAuth {

    private TestAuth() {}

    public static AuthenticatedUser as(AppUserRepository repo, String username) {
        AppUser u = repo.findByUsernameIgnoreCase(username).orElseThrow();
        AuthenticatedUser au = new AuthenticatedUser(u.getId(), u.getUsername(), u.getName(), AppRoles.normalize(u.getRole()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                au, null, List.of(new SimpleGrantedAuthority("ROLE_" + au.role()))));
        return au;
    }

    public static void clear() {
        SecurityContextHolder.clearContext();
    }

    public static String bearer(AppUserRepository repo, JwtTokenProvider jwt, String username) {
        AppUser u = repo.findByUsernameIgnoreCase(username).orElseThrow();
        return "Bearer " + jwt.generateToken(u.getId(), u.getUsername(), AppRoles.normalize(u.getRole()), u.getName());
    }
}
