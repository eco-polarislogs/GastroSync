package com.gastrosync.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gastrosync.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Custom entry point for handling unauthorized access attempts (HTTP 401).
 *
 * WHY a custom AuthenticationEntryPoint?
 * ──────────────────────────────────────
 * By default, Spring Security returns a plain text "401 Unauthorized" response
 * or redirects to a login page (designed for server-rendered HTML apps).
 *
 * For a REST API consumed by React and React Native clients, we need:
 *   1. A JSON response body (not HTML or plain text)
 *   2. Our standardized ApiResponse<T> format for consistency
 *   3. Proper Content-Type header (application/json)
 *
 * This ensures the frontend's Axios interceptor receives a structured error
 * it can parse and display to the user, rather than an opaque HTML page.
 *
 * THESIS NOTE: This follows the principle of UNIFORM ERROR RESPONSES —
 * every error from the API (validation, not-found, unauthorized) uses the
 * same ApiResponse wrapper, making frontend error handling predictable.
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationEntryPoint.class);
    private final ObjectMapper objectMapper;

    public JwtAuthenticationEntryPoint() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    /**
     * Invoked when an unauthenticated user attempts to access a protected resource.
     *
     * Instead of Spring's default behavior (HTML login page or plain text),
     * we return a clean JSON response in our ApiResponse format.
     */
    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        log.warn("🔒 Unauthorized access attempt: {} {} — Reason: {}",
                request.getMethod(), request.getRequestURI(), authException.getMessage());

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

        ApiResponse<Void> errorResponse = ApiResponse.error(
                "Kimlik doğrulama başarısız — Lütfen giriş yapın (Authentication required)"
        );

        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
