package com.gastrosync.config;

import org.springframework.data.domain.AuditorAware;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Bridges Spring Security's SecurityContext with Spring Data JPA Auditing.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN & THESIS DEFENSE
 * ═══════════════════════════════════════════════════════════════
 *
 * HOW AUDITOR RESOLUTION WORKS:
 * 1. ThreadLocal Context Access:
 *    Spring Security stores the active user in a ThreadLocal `SecurityContext`.
 *    Whenever a JPA entity lifecycle event occurs on that request thread,
 *    this class intercepts the call and inspects the Authentication object.
 *
 * 2. Authenticated Requests:
 *    When a JWT-authenticated REST call arrives (e.g. Ahmet, Canan),
 *    `authentication.getName()` yields their unique username, which is written
 *    directly into the `created_by` or `updated_by` columns.
 *
 * 3. Fallback for Internal Tasks:
 *    Background workers, CommandLineRunners (DataSeeder), or unauthenticated
 *    seed scripts don't have an interactive JWT. In those cases, we gracefully
 *    fallback to "SYSTEM", preventing NullPointerExceptions while maintaining
 *    traceability.
 */
@Component("auditorAwareProvider")
public class SecurityAuditorAware implements AuditorAware<String> {

    @Override
    @NonNull
    public Optional<String> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null ||
            !authentication.isAuthenticated() ||
            authentication instanceof AnonymousAuthenticationToken) {
            return Optional.of("SYSTEM");
        }

        return Optional.ofNullable(authentication.getName());
    }
}
