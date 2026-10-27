package com.gastrosync.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Activates Spring Data JPA Auditing across the application.
 *
 * Configured with `auditorAwareRef = "auditorAwareProvider"` to link
 * the @CreatedBy and @LastModifiedBy annotations to our SecurityAuditorAware bean.
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorAwareProvider")
public class JpaConfig {
}
