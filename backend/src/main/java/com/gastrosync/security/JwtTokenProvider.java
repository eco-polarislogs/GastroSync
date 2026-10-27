package com.gastrosync.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Central JWT token management component for the GastroSync ERP.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL ROLE (for Thesis Defense)
 * ═══════════════════════════════════════════════════════════════
 *
 * This class is the SINGLE RESPONSIBILITY holder for all JWT operations:
 *   1. Token GENERATION  — after successful login
 *   2. Token VALIDATION  — on every subsequent request
 *   3. Claims EXTRACTION — retrieving username, role, userId from the token
 *
 * WHY a dedicated provider class instead of inline logic?
 * ──────────────────────────────────────────────────────
 * • SINGLE RESPONSIBILITY PRINCIPLE (SRP): JWT cryptographic operations are
 *   isolated from HTTP handling (controller) and business logic (service).
 * • TESTABILITY: This class can be unit-tested independently with mock keys.
 * • REPLACEABILITY: If we switch from HMAC to RSA signing (for microservices),
 *   only THIS class changes — the rest of the system is unaffected (Open/Closed Principle).
 *
 * WHY HMAC-SHA256 (HS256)?
 * ────────────────────────
 * For a monolithic application where the same server both signs and verifies tokens,
 * symmetric-key HMAC is simpler and faster than asymmetric RSA. The secret key never
 * leaves the server. In a microservices architecture, we would switch to RS256 (RSA)
 * so that services can verify tokens without knowing the signing key.
 *
 * WHY stateless tokens?
 * ─────────────────────
 * Traditional session-based auth stores session state on the server (often in Redis or
 * a database). JWT eliminates this requirement — the token IS the session. This means:
 *   • No server-side session storage needed
 *   • Horizontal scaling is trivial (any server can validate any token)
 *   • RESTful architectural purity (each request is self-contained)
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private final SecretKey signingKey;
    private final long expirationMs;
    private final String issuer;

    /**
     * Constructor injection with externalized configuration.
     *
     * WHY @Value injection instead of hardcoding?
     * ────────────────────────────────────────────
     * The JWT secret is the most sensitive value in the system. If compromised,
     * an attacker can forge tokens for ANY role (including ADMIN). By loading it
     * from application.properties → environment variables, we ensure:
     *   1. The secret is never committed to Git
     *   2. Different environments (dev/staging/prod) use different keys
     *   3. Key rotation only requires changing an env variable, not recompiling
     *
     * WHY Base64 decoding?
     * ────────────────────
     * JJWT 0.12+ requires a SecretKey object, not a raw string. We store the key
     * as a Base64-encoded string in config (safe for YAML/properties files) and
     * decode it at startup to produce the cryptographic key object.
     */
    public JwtTokenProvider(
            @Value("${gastrosync.jwt.secret}") String base64Secret,
            @Value("${gastrosync.jwt.expiration-ms}") long expirationMs,
            @Value("${gastrosync.jwt.issuer}") String issuer) {

        // Decode the Base64-encoded secret into raw bytes, then create an HMAC-SHA key
        byte[] keyBytes = Decoders.BASE64.decode(base64Secret);
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
        this.issuer = issuer;

        log.info("✅ JwtTokenProvider initialized — Token TTL: {}ms, Issuer: {}", expirationMs, issuer);
    }

    // ═══════════════════════════════════════════════════════════════
    // TOKEN GENERATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generates a signed JWT token after successful authentication.
     *
     * Token payload (claims):
     * ───────────────────────
     *   sub   = username          (standard JWT subject claim)
     *   role  = "ADMIN"           (custom claim for RBAC)
     *   userId = 42               (custom claim for resource ownership checks)
     *   name  = "Ahmet Yılmaz"   (custom claim for frontend display)
     *   iss   = "GastroSync-ERP"  (identifies who issued the token)
     *   iat   = <timestamp>       (issued-at time)
     *   exp   = <timestamp>       (expiration time)
     *
     * WHY include role in the token?
     * ──────────────────────────────
     * This enables the frontend to make UI decisions (show/hide menu items)
     * without making an extra API call. However, the BACKEND always re-validates
     * the role from the token on every request — the frontend role is only for UX,
     * never for security decisions.
     *
     * @param userId   the database ID of the authenticated user
     * @param username the unique username (used as JWT subject)
     * @param role     the user's role (for RBAC claims)
     * @param name     the user's display name (for frontend convenience)
     * @return a compact, signed JWT string
     */
    public String generateToken(Long userId, String username, String role, String name) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(username)                      // Standard claim: who this token belongs to
                .claim("role", role)                     // Custom claim: user's RBAC role
                .claim("userId", userId)                 // Custom claim: database ID for ownership checks
                .claim("name", name)                     // Custom claim: display name for frontend
                .issuer(issuer)                          // Standard claim: who issued this token
                .issuedAt(now)                           // Standard claim: when was it issued
                .expiration(expiry)                      // Standard claim: when does it expire
                .signWith(signingKey, Jwts.SIG.HS256)    // Sign with HMAC-SHA256
                .compact();                              // Serialize to compact form (xxx.yyy.zzz)
    }

    // ═══════════════════════════════════════════════════════════════
    // TOKEN VALIDATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Validates the structural integrity and cryptographic signature of a JWT.
     *
     * This method catches ALL possible JWT failure modes:
     *   • ExpiredJwtException     — token TTL has passed
     *   • MalformedJwtException   — token structure is invalid
     *   • UnsupportedJwtException — token uses an unsupported algorithm
     *   • SecurityException       — signature verification failed (tampered token)
     *   • IllegalArgumentException — token string is null/empty
     *
     * WHY catch-all with specific logging?
     * ────────────────────────────────────
     * In production, we need to distinguish between normal expiration (user needs
     * to re-login) vs. signature failures (possible attack attempt). Each exception
     * type is logged differently for security monitoring.
     *
     * @param token the JWT string to validate
     * @return true if the token is valid and not expired
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(signingKey)    // Verify the signature with our secret key
                    .requireIssuer(issuer)     // Reject tokens from other issuers
                    .build()
                    .parseSignedClaims(token); // Parse and validate — throws on any failure
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("⏰ JWT token expired for user: {}", ex.getClaims().getSubject());
        } catch (MalformedJwtException ex) {
            log.warn("🚨 Malformed JWT token detected");
        } catch (UnsupportedJwtException ex) {
            log.warn("🚨 Unsupported JWT token algorithm");
        } catch (SecurityException ex) {
            log.warn("🚨 JWT signature verification failed — possible tampering attempt");
        } catch (IllegalArgumentException ex) {
            log.warn("⚠️ JWT token string is null or empty");
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIMS EXTRACTION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Extracts the username (subject) from a validated JWT.
     * This is called by JwtAuthenticationFilter to identify the user on each request.
     */
    public String getUsername(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * Extracts the role claim from a validated JWT.
     * Used to build the GrantedAuthority for Spring Security's RBAC system.
     */
    public String getRole(String token) {
        return parseClaims(token).get("role", String.class);
    }

    /**
     * Extracts the userId claim from a validated JWT.
     * Used for BOLA/IDOR prevention — ensuring users can only access their own resources.
     */
    public Long getUserId(String token) {
        return parseClaims(token).get("userId", Long.class);
    }

    /**
     * Internal helper to parse claims from a token.
     * Called only AFTER validateToken() has confirmed the token is valid.
     */
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
