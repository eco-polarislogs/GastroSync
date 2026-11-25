package com.gastrosync.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.gastrosync.dto.PageResponse;
import com.gastrosync.model.AuditLog;
import com.gastrosync.repository.AuditLogRepository;
import com.gastrosync.security.CurrentUserService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Denetim izi yazici. Kayitlar yalnizca eklenir; guncellenemez ve silinemez.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;
    private final CurrentUserService currentUserService;

    public AuditService(AuditLogRepository auditLogRepository, CurrentUserService currentUserService) {
        this.auditLogRepository = auditLogRepository;
        this.currentUserService = currentUserService;
    }

    /** Islem yapan kisi guvenlik baglamindan alinir */
    @Transactional(propagation = Propagation.REQUIRED)
    public void log(String action, String entityType, Long entityId, String fromStatus, String toStatus, String detail) {
        logAs(currentUserService.username(), currentUserService.role(), action, entityType, entityId, fromStatus, toStatus, detail);
    }

    /**
     * Ana islemden bagimsiz yazilir: ana islem geri alinsa bile (orn. reddedilen giris
     * denemesi) denetim kaydi korunur.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logIndependent(String actor, String role, String action, String entityType, Long entityId, String detail) {
        logAs(actor, role, action, entityType, entityId, null, null, detail);
    }

    private void logAs(String actor, String role, String action, String entityType, Long entityId,
                       String fromStatus, String toStatus, String detail) {
        try {
            AuditLog entry = new AuditLog(actor, role, action, entityType, entityId, fromStatus, toStatus, detail);
            entry.setIpAddress(currentIp());
            auditLogRepository.save(entry);
        } catch (RuntimeException ex) {
            log.error("Denetim kaydi yazilamadi: action={} entity={}#{}", action, entityType, entityId, ex);
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLog> history(String entityType, Long entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByTimestampAsc(entityType, entityId);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> recent(String entityType, int limit) {
        PageRequest page = PageRequest.of(0, Math.min(Math.max(limit, 1), 500));
        if (entityType != null && !entityType.isBlank()) {
            return auditLogRepository.findByEntityTypeOrderByTimestampDesc(entityType.toUpperCase(), page);
        }
        return auditLogRepository.findAllByOrderByTimestampDesc(page);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLog> page(String entityType, String text, Integer page, Integer size) {
        return page(entityType, text, page, size, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLog> page(String entityType, String text, Integer page, Integer size, String sort) {
        Specification<AuditLog> spec = (root, q, cb) -> cb.conjunction();
        if (entityType != null && !entityType.isBlank()) {
            String et = entityType.trim().toUpperCase(java.util.Locale.ROOT);
            spec = spec.and((root, q, cb) -> cb.equal(root.get("entityType"), et));
        }
        if (text != null && !text.isBlank()) {
            String like = "%" + text.trim().toLowerCase(java.util.Locale.ROOT) + "%";
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("actor")), like),
                    cb.like(cb.lower(root.get("action")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("detail"), "")), like)));
        }
        Page<AuditLog> result = auditLogRepository.findAll(spec, PageRequest.of(PageResponse.clampPage(page),
                PageResponse.clampSize(size), PageResponse.sort(sort, java.util.Map.of(
                        "timestamp", "timestamp", "actor", "actor", "action", "action", "entityType", "entityType"),
                        Sort.by(Sort.Order.desc("timestamp"), Sort.Order.desc("id")))));
        return PageResponse.of(result);
    }

    public static String currentIp() {
        try {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                HttpServletRequest req = attrs.getRequest();
                String fwd = req.getHeader("X-Forwarded-For");
                if (fwd != null && !fwd.isBlank()) {
                    return fwd.split(",")[0].trim();
                }
                return req.getRemoteAddr();
            }
        } catch (RuntimeException ignored) {
            // istek baglami yok (WebSocket / zamanlanmis gorev)
        }
        return null;
    }
}
