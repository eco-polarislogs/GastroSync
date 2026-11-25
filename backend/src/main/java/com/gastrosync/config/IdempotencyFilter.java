package com.gastrosync.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import com.gastrosync.model.IdempotencyRecord;
import com.gastrosync.repository.IdempotencyRecordRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Idempotency-Key destegi (POST / PUT / DELETE, /api altinda, oturum uclari haric).
 *
 * Mobil uygulama baglanti koptugunda siparis ve tahsilati cihazda kuyruklar; baglanti gelince ayni
 * anahtarla yeniden gonderir. Istek sunucuya ulasip yanit cihaza ulasmadiysa ikinci gonderim islemi
 * tekrarlamaz: ilk basarili (2xx) yanit aynen dondurulur ("Idempotent-Replay: true").
 * Basarisiz yanitlar saklanmaz; duzeltilmis istek ayni anahtarla tekrar denenebilir.
 * Spring Security'den sonra calisir (kullanici adi anahtarin parcasidir).
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyFilter.class);
    public static final String HEADER = "Idempotency-Key";
    private static final Pattern KEY = Pattern.compile("^[A-Za-z0-9._:-]{8,100}$");
    private static final long CLEANUP_INTERVAL_MS = 60L * 60 * 1000;

    private final IdempotencyRecordRepository repository;
    private volatile long lastCleanup = 0;

    public IdempotencyFilter(IdempotencyRecordRepository repository) {
        this.repository = repository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String m = request.getMethod();
        String path = request.getRequestURI();
        return request.getHeader(HEADER) == null
                || !("POST".equals(m) || "PUT".equals(m) || "DELETE".equals(m))
                || path == null || !path.startsWith("/api/") || path.startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getHeader(HEADER).trim();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String user = auth != null && auth.isAuthenticated() ? auth.getName() : null;
        if (!KEY.matcher(key).matches() || user == null || "anonymousUser".equals(user)) {
            chain.doFilter(request, response);
            return;
        }
        Optional<IdempotencyRecord> seen = repository.findByUsernameAndIdemKey(user, key);
        if (seen.isPresent()) {
            IdempotencyRecord r = seen.get();
            if (!r.getMethod().equals(request.getMethod()) || !r.getPath().equals(request.getRequestURI())) {
                response.sendError(HttpServletResponse.SC_CONFLICT, "Idempotency-Key baska bir istek icin kullanilmis");
                return;
            }
            response.setStatus(r.getStatus());
            response.setHeader("Idempotent-Replay", "true");
            response.setContentType(r.getContentType() != null ? r.getContentType() : "application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            if (r.getBody() != null) response.getWriter().write(r.getBody());
            return;
        }

        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
        try {
            chain.doFilter(request, wrapped);
            int status = wrapped.getStatus();
            if (status >= 200 && status < 300) {
                IdempotencyRecord r = new IdempotencyRecord();
                r.setIdemKey(key);
                r.setUsername(user);
                r.setMethod(request.getMethod());
                r.setPath(request.getRequestURI());
                r.setStatus(status);
                r.setContentType(wrapped.getContentType());
                byte[] body = wrapped.getContentAsByteArray();
                r.setBody(body.length > 0 && body.length < 1_000_000 ? new String(body, StandardCharsets.UTF_8) : null);
                r.setCreatedAt(LocalDateTime.now());
                try {
                    repository.save(r);
                } catch (DataIntegrityViolationException race) {
                    log.debug("Ayni Idempotency-Key eszamanli kaydedildi: {}", key);
                }
            }
        } finally {
            wrapped.copyBodyToResponse();
        }
        cleanupIfDue();
    }

    private void cleanupIfDue() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
        lastCleanup = now;
        try {
            repository.deleteOlderThan(LocalDateTime.now().minusDays(7));
        } catch (RuntimeException e) {
            log.debug("Idempotency kayit temizligi yapilamadi: {}", e.getMessage());
        }
    }
}
