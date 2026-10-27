package com.gastrosync.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

/**
 * Enterprise Internationalization (i18n) Configuration.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. ACCEPT-HEADER LOCALE RESOLVER:
 *    Inspects the standard HTTP RFC 7231 `Accept-Language` header sent
 *    by clients (React / React Native / Axios / Mobile App).
 *    Supports: TR (Turkish), EN (English), DE (German), AR (Arabic).
 *    Defaults gracefully to Turkish (`tr`) if unspecified.
 *
 * 2. UTF-8 RELOADABLE MESSAGE SOURCE:
 *    Loads i18n resource bundles (`messages_tr.properties`, `messages_en.properties`,
 *    `messages_de.properties`, `messages_ar.properties`) with explicit UTF-8 encoding
 *    to preserve special characters, umlauts, and Arabic glyphs.
 */
@Configuration
public class LocaleConfig {

    public static final Locale LOCALE_TR = Locale.forLanguageTag("tr");
    public static final Locale LOCALE_EN = Locale.ENGLISH;
    public static final Locale LOCALE_DE = Locale.GERMAN;
    public static final Locale LOCALE_AR = Locale.forLanguageTag("ar");

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(LOCALE_TR);
        resolver.setSupportedLocales(Arrays.asList(LOCALE_TR, LOCALE_EN, LOCALE_DE, LOCALE_AR));
        return resolver;
    }

    @Bean
    public MessageSource messageSource() {
        ReloadableResourceBundleMessageSource messageSource = new ReloadableResourceBundleMessageSource();
        messageSource.setBasename("classpath:messages");
        messageSource.setDefaultEncoding(StandardCharsets.UTF_8.name());
        messageSource.setFallbackToSystemLocale(false);
        messageSource.setCacheSeconds(3600); // Cache for 1 hour in production
        return messageSource;
    }
}
