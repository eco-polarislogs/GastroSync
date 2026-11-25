package com.gastrosync.security;

import java.io.IOException;

import org.springframework.context.annotation.Lazy;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gastrosync.dto.ApiResponse;
import com.gastrosync.service.SecurityAlertService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filtre seviyesinde (URL kurali) reddedilen istekler icin 403 yaniti uretir ve
 * olayi denetim izine + yonetici bildirimlerine aktarir.
 */
@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final SecurityAlertService securityAlertService;

    public CustomAccessDeniedHandler(@Lazy SecurityAlertService securityAlertService) {
        this.securityAlertService = securityAlertService;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        securityAlertService.reportDeniedRequest(request.getMethod(), request.getRequestURI(), "API");

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(
                "Yetkisiz islem: Bu islem icin yetkiniz bulunmamaktadir. Olay denetim kaydina islendi."));
    }
}
