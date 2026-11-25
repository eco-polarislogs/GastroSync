package com.gastrosync.security;

import java.io.IOException;
import java.util.List;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Her istekte Bearer token'i dogrular; rol bilgisini veritabanindaki guncel kayittan alir.
 * Sifresini degistirmesi zorunlu olan kullanicilar yalnizca profil ve sifre degistirme
 * uc noktalarina erisebilir.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Set<String> PASSWORD_CHANGE_ALLOWED = Set.of(
            "/api/auth/me", "/api/auth/change-password", "/api/auth/logout");

    private final TokenAuthenticationService tokenAuthenticationService;

    public JwtAuthenticationFilter(TokenAuthenticationService tokenAuthenticationService) {
        this.tokenAuthenticationService = tokenAuthenticationService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String jwt = extractTokenFromRequest(request);
        if (StringUtils.hasText(jwt)) {
            var session = tokenAuthenticationService.resolve(jwt);
            if (session.isPresent()) {
                AuthenticatedUser user = session.get().user();
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);

                if (session.get().mustChangePassword()
                        && request.getRequestURI().startsWith("/api/")
                        && !PASSWORD_CHANGE_ALLOWED.contains(request.getRequestURI())) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"success\":false,\"code\":\"PASSWORD_CHANGE_REQUIRED\","
                            + "\"message\":\"Devam etmeden once sifrenizi degistirmeniz gerekiyor.\"}");
                    return;
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length()).trim();
        }
        return null;
    }
}
