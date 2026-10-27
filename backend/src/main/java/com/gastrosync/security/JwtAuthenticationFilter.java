package com.gastrosync.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT Authentication Filter — the security gateway for every HTTP request.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL ROLE (for Thesis Defense)
 * ═══════════════════════════════════════════════════════════════
 *
 * This filter sits in Spring's SecurityFilterChain and executes BEFORE any
 * controller method is invoked. Its job is simple but critical:
 *
 *   1. Extract the Bearer token from the Authorization header
 *   2. Validate the token's signature and expiration
 *   3. If valid → populate the SecurityContext with the user's identity & role
 *   4. If invalid/missing → do nothing (let the SecurityFilterChain deny access)
 *
 * WHY extend OncePerRequestFilter?
 * ─────────────────────────────────
 * Spring's filter chain can invoke filters multiple times per request (e.g., during
 * internal forwards). OncePerRequestFilter guarantees our JWT validation logic runs
 * EXACTLY ONCE per request, preventing duplicate authentication attempts and
 * improving performance.
 *
 * WHY NOT throw an exception on invalid tokens?
 * ──────────────────────────────────────────────
 * The filter should ONLY populate the SecurityContext when a valid token is found.
 * If no valid token exists, the filter does nothing — downstream security rules
 * (SecurityFilterChain's .authorizeHttpRequests()) will return 401/403 as appropriate.
 * This follows the CHAIN OF RESPONSIBILITY pattern: each filter does its part
 * and passes control to the next.
 *
 * SECURITY FLOW:
 * ──────────────
 *   Client Request
 *       │
 *       ▼
 *   ┌─────────────────────────┐
 *   │ JwtAuthenticationFilter │ ← We are here
 *   │ Extract & validate JWT  │
 *   └──────────┬──────────────┘
 *              │
 *              ▼
 *   ┌─────────────────────────┐
 *   │ SecurityFilterChain     │
 *   │ Check authorization     │
 *   └──────────┬──────────────┘
 *              │
 *              ▼
 *   ┌─────────────────────────┐
 *   │ @RestController         │
 *   │ Handle business logic   │
 *   └─────────────────────────┘
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    /** Prefix for Bearer token authentication (RFC 6750) */
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Constructor injection (no @Autowired needed with single constructor).
     *
     * WHY constructor injection?
     * ──────────────────────────
     * Spring recommends constructor injection over field injection (@Autowired) because:
     * 1. Dependencies are IMMUTABLE (final fields) — prevents accidental reassignment
     * 2. Dependencies are EXPLICIT — the constructor documents exactly what this class needs
     * 3. Enables proper unit testing — you can pass mock dependencies directly
     */
    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /**
     * Core filter logic — executed once per HTTP request.
     *
     * ALGORITHM:
     * ──────────
     * 1. Extract the JWT from the "Authorization: Bearer <token>" header
     * 2. If no token present → skip (public endpoint or unauthenticated request)
     * 3. If token present → validate its signature and expiration
     * 4. If valid → extract username and role → create Spring Authentication object
     * 5. Store Authentication in SecurityContextHolder (thread-local)
     * 6. Pass control to the next filter in the chain
     *
     * WHY SecurityContextHolder?
     * ──────────────────────────
     * Spring Security uses a ThreadLocal-based SecurityContext to carry the
     * authenticated user's identity throughout the entire request lifecycle.
     * Once we set it here, any downstream component (@Service, @Controller)
     * can access the current user via SecurityContextHolder.getContext().
     * The @PreAuthorize annotations also read from this context.
     */
    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        try {
            // Step 1: Extract the JWT from the Authorization header
            String jwt = extractTokenFromRequest(request);

            // Step 2: Validate and authenticate if token exists
            if (StringUtils.hasText(jwt) && jwtTokenProvider.validateToken(jwt)) {

                // Step 3: Extract identity claims from the validated token
                String username = jwtTokenProvider.getUsername(jwt);
                String role = jwtTokenProvider.getRole(jwt);

                /*
                 * Step 4: Create a Spring Security Authentication object.
                 *
                 * WHY "ROLE_" prefix?
                 * ───────────────────
                 * Spring Security's hasRole('ADMIN') internally checks for the authority
                 * "ROLE_ADMIN". By adding the prefix here, we ensure @PreAuthorize("hasRole('ADMIN')")
                 * works correctly. Without this prefix, we'd need hasAuthority('ADMIN') instead.
                 * The ROLE_ convention is a Spring Security standard that the jury will expect.
                 */
                SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                username,       // Principal — the identity (username)
                                null,           // Credentials — null because JWT replaces password
                                List.of(authority)  // Authorities — the user's roles/permissions
                        );

                // Attach HTTP request details (IP, session ID) to the authentication
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                // Step 5: Store in the SecurityContext — makes the user "logged in" for this request
                SecurityContextHolder.getContext().setAuthentication(authentication);

                log.debug("✅ Authenticated user '{}' with role '{}' for: {} {}",
                        username, role, request.getMethod(), request.getRequestURI());
            }
        } catch (Exception ex) {
            /*
             * WHY catch Exception broadly here?
             * ──────────────────────────────────
             * This filter runs BEFORE any controller. If an unhandled exception
             * escapes here, Spring returns an opaque 500 error. By catching and
             * logging, we ensure the SecurityFilterChain can properly return
             * 401 Unauthorized instead.
             */
            log.error("🚨 JWT authentication processing failed: {}", ex.getMessage());
        }

        // Step 6: Always pass control to the next filter (even if auth failed)
        filterChain.doFilter(request, response);
    }

    /**
     * Extracts the JWT token from the HTTP Authorization header.
     *
     * Expected header format (per RFC 6750 — Bearer Token Usage):
     *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     *
     * WHY check for "Bearer " prefix?
     * ────────────────────────────────
     * RFC 6750 defines multiple token transmission methods (header, query param, form body).
     * We exclusively use the Authorization header method, which requires the "Bearer " prefix.
     * This distinguishes JWT from other auth schemes (e.g., "Basic" for username/password).
     *
     * @param request the incoming HTTP request
     * @return the raw JWT string, or null if no Bearer token is present
     */
    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
