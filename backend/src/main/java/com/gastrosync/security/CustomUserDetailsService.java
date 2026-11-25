package com.gastrosync.security;

import java.util.Collections;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;

/**
 * Giris sirasinda kullanici adini VEYA e-postayi kabul eder.
 * Pasif hesaplar "disabled" olarak doner ve giris yapamaz.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;

    public CustomUserDetailsService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        String cleanId = identifier == null ? "" : identifier.trim();
        AppUser user = userRepository.findByUsernameIgnoreCase(cleanId)
                .orElseGet(() -> userRepository.findByEmailIgnoreCase(cleanId)
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new UsernameNotFoundException("Kullanici bulunamadi")));

        String role = AppRoles.normalize(user.getRole());
        return User.withUsername(user.getUsername())
                .password(user.getPassword())
                .authorities(Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role)))
                .disabled(!user.isActive())
                .build();
    }
}
