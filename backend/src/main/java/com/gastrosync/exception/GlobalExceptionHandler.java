package com.gastrosync.exception;

import com.gastrosync.dto.ApiResponse;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Locale;

/**
 * Enterprise Global Exception Handler with i18n Localization.
 *
 * Automatically inspects the HTTP Accept-Language header via LocaleContextHolder
 * and returns localized error responses in TR, EN, DE, or AR.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    public GlobalExceptionHandler(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    private String getLocalizedMessage(String code, String defaultMessage) {
        Locale currentLocale = LocaleContextHolder.getLocale();
        return messageSource.getMessage(code, null, defaultMessage, currentLocale);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        String localized = getLocalizedMessage("error.not_found", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(localized));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst()
                .orElse(getLocalizedMessage("error.validation", "Doğrulama hatası"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(msg));
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(org.springframework.security.access.AccessDeniedException ex) {
        String localized = getLocalizedMessage("error.forbidden", "Bu işlem için yetkiniz bulunmamaktadır (Yetki Yetersiz).");
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(localized));
    }

    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthenticationException(org.springframework.security.core.AuthenticationException ex) {
        String localized = getLocalizedMessage("error.unauthorized", "Kimlik doğrulama başarısız veya oturum süresi doldu.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(localized + ": " + ex.getMessage()));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        String localized = getLocalizedMessage("error.conflict", "Veritabanı kısıt ihlali veya mükerrer kayıt");
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(localized + ": " + ex.getMostSpecificCause().getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneralException(Exception ex) {
        String localized = getLocalizedMessage("error.internal", "Sistemsel bir hata oluştu");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(localized + ": " + ex.getMessage()));
    }
}
