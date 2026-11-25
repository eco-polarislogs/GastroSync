package com.gastrosync.service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.AccountingPeriod;
import com.gastrosync.model.Expense;
import com.gastrosync.repository.AccountingPeriodRepository;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Muhasebe donemi kapanisi (yalnizca Mali Musavir).
 *
 *  - Yalnizca gecmis donemler kapatilabilir; kapanmadan once tum giderler kesinlesmis
 *    (FINALIZED) veya reddedilmis olmalidir.
 *  - Kapali donemde gider olusturma / duzenleme / onay / satis iptali yapilamaz.
 *  - Yeniden acma gerekce gerektirir ve tum finans ekibine bildirilir.
 */
@Service
@Transactional
public class AccountingPeriodService {

    private final AccountingPeriodRepository periodRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;

    public AccountingPeriodService(AccountingPeriodRepository periodRepository, ExpenseRepository expenseRepository,
                                   AuditService auditService, NotificationService notificationService,
                                   CurrentUserService currentUserService) {
        this.periodRepository = periodRepository;
        this.expenseRepository = expenseRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    public static String validatePeriod(String period) {
        if (period == null) throw new IllegalArgumentException("Donem (YYYY-MM) zorunludur");
        try {
            return YearMonth.parse(period.trim()).toString();
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Donem formati YYYY-MM olmalidir: " + period);
        }
    }

    @Transactional(readOnly = true)
    public boolean isClosed(String period) {
        if (period == null) return false;
        return periodRepository.findByPeriod(period).map(AccountingPeriod::isClosed).orElse(false);
    }

    public void assertOpen(String period) {
        if (isClosed(period)) {
            throw new BusinessRuleException(period + " muhasebe donemi Mali Musavir tarafindan kapatilmistir. "
                    + "Bu doneme ait kayitlar degistirilemez.");
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> rows = new ArrayList<>();
        YearMonth now = YearMonth.now();
        Map<String, AccountingPeriod> stored = new LinkedHashMap<>();
        periodRepository.findAllByOrderByPeriodDesc().forEach(p -> stored.put(p.getPeriod(), p));
        for (int i = 0; i < 12; i++) {
            String p = now.minusMonths(i).toString();
            stored.putIfAbsent(p, new AccountingPeriod(p));
        }
        stored.values().stream()
                .sorted((a, b) -> b.getPeriod().compareTo(a.getPeriod()))
                .forEach(p -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("period", p.getPeriod());
                    row.put("status", p.getStatus());
                    row.put("closedBy", p.getClosedBy());
                    row.put("closedAt", p.getClosedAt());
                    row.put("reopenedBy", p.getReopenedBy());
                    row.put("reopenedAt", p.getReopenedAt());
                    row.put("note", p.getNote());
                    row.put("openItems", expenseRepository.countByPeriodAndStatusIn(p.getPeriod(),
                            Set.of(Expense.STATUS_PENDING, Expense.STATUS_APPROVED)));
                    row.put("canClose", !p.isClosed() && YearMonth.parse(p.getPeriod()).isBefore(now));
                    rows.add(row);
                });
        return rows;
    }

    private void requireAdvisor() {
        if (!currentUserService.can(Permissions.P.PERIOD_MANAGE)) {
            throw new org.springframework.security.access.AccessDeniedException("Donem kapama / acma yalnizca Mali Musavir yetkisindedir");
        }
    }

    public AccountingPeriod close(String rawPeriod, String note) {
        requireAdvisor();
        String period = validatePeriod(rawPeriod);
        if (!YearMonth.parse(period).isBefore(YearMonth.now())) {
            throw new BusinessRuleException("Yalnizca tamamlanmis (gecmis) donemler kapatilabilir");
        }
        long open = expenseRepository.countByPeriodAndStatusIn(period, Set.of(Expense.STATUS_PENDING, Expense.STATUS_APPROVED));
        if (open > 0) {
            throw new BusinessRuleException(period + " doneminde kesinlesmemis " + open
                    + " gider kaydi var. Donem kapanisindan once tum kayitlar deftere islenmeli veya reddedilmelidir.");
        }
        AccountingPeriod p = periodRepository.findByPeriod(period).orElseGet(() -> new AccountingPeriod(period));
        if (p.isClosed()) throw new BusinessRuleException(period + " donemi zaten kapali");
        p.setStatus(AccountingPeriod.CLOSED);
        p.setClosedBy(currentUserService.displayName());
        p.setClosedAt(LocalDateTime.now());
        p.setNote(note);
        AccountingPeriod saved = periodRepository.save(p);
        auditService.log("PERIOD_CLOSED", "PERIOD", saved.getId(), AccountingPeriod.OPEN, AccountingPeriod.CLOSED,
                period + (note != null && !note.isBlank() ? " | " + note : ""));
        notificationService.notify(List.of(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.ACCOUNTANT),
                period + " Donemi Kapatildi",
                currentUserService.displayName() + " " + period + " muhasebe donemini kapatti. Bu doneme ait kayitlar artik degistirilemez.",
                currentUserService.displayName(), "PERIOD", saved.getId(), "/advisor-ledger", "INFO");
        return saved;
    }

    public AccountingPeriod reopen(String rawPeriod, String reason) {
        requireAdvisor();
        String period = validatePeriod(rawPeriod);
        if (reason == null || reason.trim().length() < 10) {
            throw new IllegalArgumentException("Donemi yeniden acmak icin en az 10 karakterlik gerekce zorunludur");
        }
        AccountingPeriod p = periodRepository.findByPeriod(period)
                .filter(AccountingPeriod::isClosed)
                .orElseThrow(() -> new BusinessRuleException(period + " donemi zaten acik"));
        p.setStatus(AccountingPeriod.OPEN);
        p.setReopenedBy(currentUserService.displayName());
        p.setReopenedAt(LocalDateTime.now());
        p.setNote("Yeniden acilma gerekcesi: " + reason.trim());
        AccountingPeriod saved = periodRepository.save(p);
        auditService.log("PERIOD_REOPENED", "PERIOD", saved.getId(), AccountingPeriod.CLOSED, AccountingPeriod.OPEN,
                period + " | " + reason.trim());
        notificationService.notify(List.of(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.ACCOUNTANT),
                period + " Donemi Yeniden Acildi",
                currentUserService.displayName() + " " + period + " donemini yeniden acti. Gerekce: " + reason.trim(),
                currentUserService.displayName(), "PERIOD", saved.getId(), "/advisor-ledger", "WARNING");
        return saved;
    }
}
