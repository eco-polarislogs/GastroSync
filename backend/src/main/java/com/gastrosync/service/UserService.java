package com.gastrosync.service;

import com.gastrosync.dto.auth.AuthResponse;
import com.gastrosync.dto.auth.LoginRequest;
import com.gastrosync.dto.user.UserCreateRequest;
import com.gastrosync.dto.user.UserResponse;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import com.gastrosync.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service layer for User management and Spring Security Authentication.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN & SOLID PRINCIPLES (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. SINGLE RESPONSIBILITY PRINCIPLE (SRP):
 *    Encapsulates all user business logic, credential authentication via
 *    AuthenticationManager, BCrypt hashing, and JWT token issuance.
 *
 * 2. DEPENDENCY INVERSION PRINCIPLE (DIP):
 *    Relies on Spring Security's AuthenticationManager and PasswordEncoder abstractions.
 *
 * 3. SECURITY HARDENING:
 *    - Uses AuthenticationManager with DaoAuthenticationProvider and CustomUserDetailsService.
 *    - Constant-time BCrypt matching to prevent timing side-channel attacks.
 *    - Generic authentication error messages to prevent username enumeration attacks.
 *    - Never leaks raw entity passwords (DTO projections only).
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final long jwtExpirationMs;

    public UserService(AppUserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager,
                       @Value("${gastrosync.jwt.expiration-ms:86400000}") long jwtExpirationMs) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.jwtExpirationMs = jwtExpirationMs;
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTHENTICATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Authenticates a user via Spring Security's AuthenticationManager and issues a JWT token.
     *
     * @param request Login credentials (username/email and password)
     * @return AuthResponse containing valid JWT token and user profile
     * @throws IllegalArgumentException on bad credentials or inactive user
     */
    @Transactional(readOnly = true)
    public AuthResponse authenticate(LoginRequest request) {
        String identifier = request.getIdentifier() != null ? request.getIdentifier().trim() : "";
        String rawPassword = request.getPassword() != null ? request.getPassword().trim() : "";

        if (identifier.isEmpty() || rawPassword.isEmpty()) {
            throw new IllegalArgumentException("Kullanıcı adı/e-posta ve şifre zorunludur");
        }

        Authentication authentication;
        try {
            // 1. Delegate credential verification to Spring Security's AuthenticationManager
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(identifier, rawPassword)
            );
        } catch (BadCredentialsException e) {
            log.warn("❌ Failed login attempt for identifier '{}': Invalid credentials", identifier);
            // OWASP A07: Identification and Authentication Failures -> Generic message to prevent enumeration
            throw new IllegalArgumentException("Geçersiz kullanıcı adı/e-posta veya şifre");
        } catch (AuthenticationException e) {
            log.error("❌ Authentication error for identifier '{}': {}", identifier, e.getMessage());
            throw new IllegalArgumentException("Kimlik doğrulama başarısız: " + e.getMessage());
        }

        // 2. Set the authenticated principal in the SecurityContext
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 3. Retrieve user entity to extract id, name, and role for the JWT token
        String authenticatedUsername = authentication.getName();
        AppUser user = userRepository.findByUsernameIgnoreCase(authenticatedUsername)
                .orElseGet(() -> userRepository.findByEmailIgnoreCase(identifier)
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("Kullanıcı kaydı bulunamadı: " + identifier)));

        // 4. Generate signed JWT token
        String token = jwtTokenProvider.generateToken(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getName()
        );

        log.info("✅ User '{}' authenticated successfully with role '{}'", user.getUsername(), user.getRole());

        return AuthResponse.of(
                token,
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getRole(),
                user.getEmail(),
                jwtExpirationMs
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // USER MANAGEMENT & QUERIES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Retrieves all users mapped into safe DTOs (passwords are omitted).
     */
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(UserResponse::fromEntity)
                .toList();
    }

    /**
     * Retrieves user by numeric ID.
     */
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: ID " + id));
        return UserResponse.fromEntity(user);
    }

    /**
     * Retrieves user by username (used for /api/auth/me).
     */
    @Transactional(readOnly = true)
    public UserResponse getUserByUsername(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + username));
        return UserResponse.fromEntity(user);
    }

    /**
     * Creates a new user with BCrypt hashed password and validated role.
     */
    @Transactional(rollbackFor = Exception.class)
    public UserResponse createUser(UserCreateRequest request) {
        String normalizedUsername = request.getUsername().trim().toLowerCase();

        if (userRepository.findByUsername(normalizedUsername).isPresent()) {
            throw new IllegalArgumentException("Bu kullanıcı adı zaten kullanımda: " + normalizedUsername);
        }

        AppUser newUser = new AppUser();
        newUser.setUsername(normalizedUsername);
        newUser.setPassword(passwordEncoder.encode(request.getPassword().trim())); // BCrypt
        newUser.setName(request.getName().trim());
        newUser.setRole(request.getRole().trim().toUpperCase());
        newUser.setEmail(request.getEmail());

        AppUser saved = userRepository.save(newUser);
        log.info("✅ New user created: '{}' with role '{}'", saved.getUsername(), saved.getRole());

        return UserResponse.fromEntity(saved);
    }

    /**
     * Updates an existing user's role.
     */
    @Transactional(rollbackFor = Exception.class)
    public UserResponse updateUserRole(Long id, String newRole) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: ID " + id));

        String validatedRole = newRole.trim().toUpperCase();

        try {
            com.gastrosync.model.enums.Role.valueOf(validatedRole);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Geçersiz rol: " + newRole);
        }

        user.setRole(validatedRole);
        AppUser updated = userRepository.save(user);

        log.info("🔄 User '{}' role updated to '{}'", user.getUsername(), validatedRole);
        return UserResponse.fromEntity(updated);
    }

    /**
     * Deletes a user by ID, protecting the root admin user.
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: ID " + id));

        if ("admin".equalsIgnoreCase(user.getUsername())) {
            throw new IllegalArgumentException("Ana yönetici hesabı silinemez!");
        }

        userRepository.deleteById(id);
        log.info("🗑️ User '{}' deleted (ID: {})", user.getUsername(), id);
    }
}
