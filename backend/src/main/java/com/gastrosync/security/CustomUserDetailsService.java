package com.gastrosync.security;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Custom UserDetailsService implementation bridging Spring Security with GastroSync's AppUser entity.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL JUSTIFICATION (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * Spring Security's AuthenticationManager delegates authentication to an
 * AuthenticationProvider (DaoAuthenticationProvider by default). That provider
 * requires a UserDetailsService to load user credentials and granted authorities.
 *
 * FEATURES:
 * 1. DUAL LOOKUP: Users can log in using either their username or email address.
 * 2. ROLE NORMALIZATION: Ensures Spring Security's "ROLE_" prefix convention is respected.
 * 3. IMMUTABILITY: Converts domain entity into Spring's standard UserDetails contract.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;

    public CustomUserDetailsService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        String cleanId = identifier.trim();

        // 1. Search by username first, fallback to email
        AppUser user = userRepository.findByUsernameIgnoreCase(cleanId)
                .orElseGet(() -> userRepository.findByEmailIgnoreCase(cleanId)
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new UsernameNotFoundException("Kullanıcı bulunamadı: " + cleanId)));

        // 2. Normalize role authority: "ADMIN" -> "ROLE_ADMIN"
        String role = user.getRole();
        if (role != null && !role.startsWith("ROLE_")) {
            role = "ROLE_" + role.toUpperCase();
        } else if (role == null) {
            role = "ROLE_WAITER";
        }

        return new User(
                user.getUsername(),
                user.getPassword(),
                Collections.singletonList(new SimpleGrantedAuthority(role))
        );
    }
}
