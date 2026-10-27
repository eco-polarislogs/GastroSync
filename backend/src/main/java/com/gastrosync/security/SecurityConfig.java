package com.gastrosync.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Central Spring Security configuration for the GastroSync ERP.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DECISIONS (for Thesis Defense)
 * ═══════════════════════════════════════════════════════════════
 *
 * This class configures the ENTIRE security posture of the application:
 *   1. Which endpoints are public vs. protected
 *   2. How sessions are managed (STATELESS for JWT)
 *   3. Which authentication filter to use (our JwtAuthenticationFilter)
 *   4. How unauthorized requests are handled (our JwtAuthenticationEntryPoint)
 *   5. CSRF protection policy (disabled for stateless REST APIs)
 *
 * WHY @EnableMethodSecurity?
 * ──────────────────────────
 * This activates @PreAuthorize, @PostAuthorize, and @Secured annotations.
 * These enable GRANULAR, method-level RBAC — e.g., only ADMIN and MANAGER
 * can create users, only ACCOUNTANT can approve expenses. This is more
 * flexible than URL-pattern-based rules in the SecurityFilterChain because:
 *   • It follows the PROXIMITY PRINCIPLE — the security rule is right next
 *     to the method it protects, not in a distant config file
 *   • It's enforced even if the endpoint URL changes
 *   • It reads like documentation: @PreAuthorize("hasRole('ADMIN')")
 *
 * WHY STATELESS session policy?
 * ─────────────────────────────
 * Traditional web apps use JSESSIONID cookies (server-side sessions).
 * For a REST API consumed by React (web) and React Native (mobile):
 *   • Mobile apps can't easily manage cookies
 *   • Each API server instance would need session replication (expensive)
 *   • JWT tokens make the server truly stateless (each request is self-contained)
 *
 * WHY disable CSRF?
 * ─────────────────
 * CSRF protection is designed for browser-based cookie authentication.
 * Since we use JWT Bearer tokens (not cookies), CSRF attacks are not applicable.
 * The JWT token must be explicitly attached to each request header by the client,
 * which a CSRF attacker cannot do from a cross-origin form submission.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // Activates @PreAuthorize on controller/service methods
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
    }

    /**
     * Defines the SecurityFilterChain — the core security policy.
     *
     * ENDPOINT SECURITY MATRIX:
     * ─────────────────────────
     *   PUBLIC (no auth needed):
     *     POST /api/auth/login      — users must be able to login without a token
     *     POST /api/auth/register   — new user registration (can be restricted later)
     *     GET  /swagger-ui/**       — API documentation (for development & jury demo)
     *     GET  /v3/api-docs/**      — OpenAPI schema
     *
     *   PROTECTED (JWT required):
     *     ALL other endpoints        — requires valid Bearer token
     *
     *   ROLE-BASED (via @PreAuthorize on methods):
     *     Configured per-method in controllers/services — not here.
     *     This keeps URL-level rules simple and role logic close to the code.
     *
     * WHY addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)?
     * ─────────────────────────────────────────────────────────────────────────────────
     * Our JWT filter must execute BEFORE Spring's default username/password filter.
     * This ensures the SecurityContext is populated with the JWT-authenticated user
     * before any authorization checks run. The filter ordering is critical —
     * authentication must always precede authorization.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CORS: Use the existing WebConfig CORS settings
                .cors(Customizer.withDefaults())

                // CSRF: Disable for stateless JWT-based REST API (see class-level docs)
                .csrf(AbstractHttpConfigurer::disable)

                // SESSION: STATELESS — no server-side session storage (JWT handles identity)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // EXCEPTION HANDLING: Return JSON ApiResponse for 401 errors
                .exceptionHandling(exception ->
                        exception.authenticationEntryPoint(jwtAuthenticationEntryPoint)
                )

                // ENDPOINT AUTHORIZATION RULES
                .authorizeHttpRequests(auth -> auth

                        // ── PUBLIC ENDPOINTS ──────────────────────────────────
                        // Login must be accessible without a token
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users/login").permitAll()

                        // Swagger UI & OpenAPI docs — needed for jury demo
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/v3/api-docs"
                        ).permitAll()

                        // Health check endpoint (useful for deployment monitoring)
                        .requestMatchers("/actuator/health").permitAll()

                        // ── PROTECTED ENDPOINTS ───────────────────────────────
                        // Everything else requires authentication.
                        // Fine-grained role checks are done via @PreAuthorize on methods.
                        .anyRequest().authenticated()
                )

                // JWT FILTER: Insert our JWT filter before Spring's default auth filter
                .addFilterBefore(jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * BCrypt password encoder bean — used system-wide for hashing passwords.
     *
     * WHY BCrypt?
     * ───────────
     * BCrypt is an ADAPTIVE hashing algorithm designed specifically for passwords:
     *   1. SALT: Each hash includes a random salt — two identical passwords produce
     *      different hashes, defeating rainbow table attacks.
     *   2. COST FACTOR: BCrypt is intentionally slow (configurable rounds). The default
     *      strength 10 means 2^10 = 1024 rounds of hashing. This makes brute-force
     *      attacks computationally expensive.
     *   3. INDUSTRY STANDARD: Recommended by OWASP for password storage.
     *
     * WHY NOT SHA-256 or MD5?
     * ───────────────────────
     * SHA-256 and MD5 are designed to be FAST — great for checksums, terrible for
     * passwords. An attacker with a GPU can compute billions of SHA-256 hashes per
     * second. BCrypt's intentional slowness is a FEATURE, not a bug.
     *
     * THESIS NOTE: This is a critical security decision. If the jury asks "why BCrypt
     * over SHA-256?", explain the adaptive cost factor and built-in salting.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Exposes the standard Spring Security AuthenticationManager bean.
     * Injected into UserService to authenticate user credentials via the
     * DaoAuthenticationProvider / CustomUserDetailsService chain.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
