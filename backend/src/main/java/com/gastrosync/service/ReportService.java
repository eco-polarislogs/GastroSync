package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.model.CashClosing;
import com.gastrosync.model.Expense;
import com.gastrosync.model.ExpensePayment;
import com.gastrosync.model.InventoryItem;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.StockTransaction;
import com.gastrosync.repository.CashClosingRepository;
import com.gastrosync.repository.CheckPaymentRepository;
import com.gastrosync.repository.ExpensePaymentRepository;
import com.gastrosync.repository.ExpenseRepository;
import com.gastrosync.repository.InventoryItemRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.StockTransactionRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.security.Permissions;

/**
 * Mali raporlar. Tum rakamlar kayitli islemlerden hesaplanir; tahmini oran veya sabit deger KULLANILMAZ.
 *
 *  - Donem kar/zarar ozeti (KDV haric gelir, SMM, fire, faaliyet giderleri)
 *  - KDV ozeti (hesaplanan - indirilecek)
 *  - TDHP yevmiye fis dokumu (Mali Musavirin kendi programina aktarmasi icin)
 *  - Z raporu ve kasa sayim tutanagi
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final SalesRecordRepository salesRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpensePaymentRepository paymentRepository;
    private final StockTransactionRepository stockRepository;
    private final InventoryItemRepository inventoryRepository;
    private final CashClosingRepository cashClosingRepository;
    private final AccountingPeriodService periodService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final BigDecimal targetFoodCost;

    /** Parcali (MIXED) odenen satislarin yontem dagilimi icin */
    @org.springframework.beans.factory.annotation.Autowired
    private CheckPaymentRepository checkPaymentRepository;

    /** MIXED satislarin adisyon numarasina gore yontem oranlari (tek sorguda) */
    private Map<String, Map<String, BigDecimal>> mixedShares(java.util.Collection<SalesRecord> sales) {
        java.util.Set<String> orders = new java.util.HashSet<>();
        for (SalesRecord s : sales) {
            if (SalesService.MIXED.equals(s.getPaymentMethod()) && s.getOrderNo() != null) orders.add(s.getOrderNo());
        }
        Map<String, Map<String, BigDecimal>> shares = new java.util.HashMap<>();
        if (orders.isEmpty() || checkPaymentRepository == null) return shares;
        for (com.gastrosync.model.CheckPayment p : checkPaymentRepository.findByCheckNoInAndVoidedFalse(orders)) {
            shares.computeIfAbsent(p.getCheckNo(), k -> new LinkedHashMap<>()).merge(p.getMethod(), p.getAmount(), BigDecimal::add);
        }
        return shares;
    }

    /** Satisin yontemlere dagilmis tutarlari: tek yontemli satista tek satir, MIXED'de odeme oranina gore */
    private static Map<String, BigDecimal> methodAmounts(SalesRecord s, Map<String, Map<String, BigDecimal>> shares) {
        BigDecimal total = nz(s.getTotalPrice());
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        if (!SalesService.MIXED.equals(s.getPaymentMethod())) {
            out.put(s.getPaymentMethod(), total);
            return out;
        }
        Map<String, BigDecimal> pays = shares.get(s.getOrderNo());
        BigDecimal sum = pays == null ? BigDecimal.ZERO : pays.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (pays == null || sum.signum() <= 0) {
            out.put(SalesService.CREDIT_CARD, total);
            return out;
        }
        BigDecimal allocated = BigDecimal.ZERO;
        java.util.List<Map.Entry<String, BigDecimal>> entries = new java.util.ArrayList<>(pays.entrySet());
        for (int i = 0; i < entries.size(); i++) {
            BigDecimal part = i == entries.size() - 1 ? total.subtract(allocated)
                    : total.multiply(entries.get(i).getValue()).divide(sum, 2, java.math.RoundingMode.HALF_UP);
            allocated = allocated.add(part);
            out.merge(entries.get(i).getKey(), part, BigDecimal::add);
        }
        return out;
    }

    public ReportService(SalesRecordRepository salesRepository, ExpenseRepository expenseRepository,
                         ExpensePaymentRepository paymentRepository, StockTransactionRepository stockRepository,
                         InventoryItemRepository inventoryRepository, CashClosingRepository cashClosingRepository,
                         AccountingPeriodService periodService, NotificationService notificationService,
                         AuditService auditService, CurrentUserService currentUserService,
                         @Value("${gastrosync.analytics.target-food-cost-percent:30.0}") BigDecimal targetFoodCost) {
        this.salesRepository = salesRepository;
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
        this.stockRepository = stockRepository;
        this.inventoryRepository = inventoryRepository;
        this.cashClosingRepository = cashClosingRepository;
        this.periodService = periodService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.targetFoodCost = targetFoodCost;
    }

    private static boolean recognized(Expense e) {
        return Expense.STATUS_APPROVED.equals(e.getStatus()) || e.isFinalized();
    }

    // ── Donem ozeti ────────────────────────────────────────────

    public Map<String, Object> periodSummary(String rawPeriod) {
        String period = rawPeriod == null || rawPeriod.isBlank() ? YearMonth.now().toString() : AccountingPeriodService.validatePeriod(rawPeriod);
        YearMonth ym = YearMonth.parse(period);
        LocalDateTime from = ym.atDay(1).atStartOfDay();
        LocalDateTime to = ym.plusMonths(1).atDay(1).atStartOfDay();

        List<SalesRecord> sales = salesRepository.findBySoldAtBetweenAndStatusOrderBySoldAtDesc(from, to, SalesRecord.STATUS_COMPLETED);
        BigDecimal gross = sum(sales.stream().map(SalesRecord::getTotalPrice).toList());
        BigDecimal outputVat = sum(sales.stream().map(SalesRecord::getVatAmount).toList());
        BigDecimal netRevenue = gross.subtract(outputVat);
        BigDecimal cogs = nz(stockRepository.calculateCogsBetween(from, to));
        BigDecimal waste = nz(stockRepository.sumByTypeBetween(StockTransaction.WASTE, from, to));
        BigDecimal countDiff = nz(stockRepository.sumByTypeBetween(StockTransaction.ADJUSTMENT, from, to));

        List<Expense> expenses = expenseRepository.findByPeriod(period);
        BigDecimal opex = BigDecimal.ZERO;
        BigDecimal inputVat = BigDecimal.ZERO;
        BigDecimal pendingAmount = BigDecimal.ZERO;
        Map<String, BigDecimal> opexByType = new TreeMap<>();
        long pending = 0, approved = 0, finalized = 0, rejected = 0;
        for (Expense e : expenses) {
            switch (e.getStatus()) {
                case Expense.STATUS_PENDING -> { pending++; pendingAmount = pendingAmount.add(e.getAmount()); }
                case Expense.STATUS_APPROVED -> approved++;
                case Expense.STATUS_FINALIZED -> finalized++;
                case Expense.STATUS_REJECTED -> rejected++;
                default -> { }
            }
            if (!recognized(e)) continue;
            ExpenseCatalog.ExpenseType type = ExpenseCatalog.find(e.getSubType());
            if (!"TAX".equals(type.code())) inputVat = inputVat.add(e.getVatAmount());
            if (type.profitAndLoss()) {
                opex = opex.add(e.getNetAmount());
                opexByType.merge(type.code(), e.getNetAmount(), BigDecimal::add);
            }
        }
        BigDecimal unpaid = expenseRepository.findAll().stream().filter(ReportService::recognized)
                .map(Expense::getRemainingAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal grossProfit = netRevenue.subtract(cogs);
        // Sayim farki negatifse kayip (gider), pozitifse fazla (gelir)
        BigDecimal operatingProfit = grossProfit.subtract(waste).add(countDiff).subtract(opex);

        Map<String, BigDecimal> byPayment = new TreeMap<>();
        Map<String, Map<String, BigDecimal>> shares0 = mixedShares(sales);
        sales.forEach(s -> methodAmounts(s, shares0).forEach((m, v) -> byPayment.merge(m, v, BigDecimal::add)));

        Map<String, Map<String, Object>> products = new LinkedHashMap<>();
        for (SalesRecord s : sales) {
            Map<String, Object> p = products.computeIfAbsent(s.getProductName(), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("productName", k);
                m.put("quantity", 0);
                m.put("revenue", BigDecimal.ZERO);
                m.put("cost", BigDecimal.ZERO);
                return m;
            });
            p.put("quantity", (Integer) p.get("quantity") + s.getQuantity());
            p.put("revenue", ((BigDecimal) p.get("revenue")).add(nz(s.getTotalPrice())));
            p.put("cost", ((BigDecimal) p.get("cost")).add(s.getTotalCost()));
        }
        List<Map<String, Object>> topProducts = products.values().stream()
                .sorted(Comparator.comparing((Map<String, Object> m) -> (BigDecimal) m.get("revenue")).reversed())
                .limit(10).collect(Collectors.toList());

        List<InventoryItem> items = inventoryRepository.findAll();
        BigDecimal inventoryValue = items.stream()
                .map(i -> nz(i.getCurrentStock()).multiply(nz(i.getUnitCost())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long critical = items.stream().filter(InventoryService::isCritical).count();

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("period", period);
        r.put("periodStatus", periodService.isClosed(period) ? "CLOSED" : "OPEN");
        r.put("grossRevenue", scale(gross));
        r.put("outputVat", scale(outputVat));
        r.put("netRevenue", scale(netRevenue));
        r.put("cogs", scale(cogs));
        r.put("grossProfit", scale(grossProfit));
        r.put("wasteCost", scale(waste));
        r.put("stockCountDifference", scale(countDiff));
        r.put("operatingExpenses", scale(opex));
        r.put("operatingExpensesByType", opexByType);
        r.put("operatingProfit", scale(operatingProfit));
        r.put("foodCostPercent", pct(cogs, netRevenue));
        r.put("targetFoodCostPercent", targetFoodCost);
        r.put("profitMarginPercent", pct(operatingProfit, netRevenue));
        r.put("inputVat", scale(inputVat));
        r.put("vatPayable", scale(outputVat.subtract(inputVat)));
        r.put("unpaidPayables", scale(unpaid));
        r.put("pendingApprovalCount", pending);
        r.put("pendingApprovalAmount", scale(pendingAmount));
        r.put("awaitingLedgerCount", approved);
        r.put("finalizedCount", finalized);
        r.put("rejectedCount", rejected);
        r.put("salesCount", sales.size());
        r.put("orderCount", sales.stream().map(SalesRecord::getOrderNo).distinct().count());
        r.put("revenueByPaymentMethod", byPayment);
        r.put("topProducts", topProducts);
        r.put("inventoryValue", scale(inventoryValue));
        r.put("criticalStockCount", critical);
        r.put("notes", List.of(
                "Gelirler KDV haric (net) olarak raporlanir; food cost % = SMM / net satis.",
                "Giderler onaylanmis (APPROVED) ve kesinlesmis (FINALIZED) kayitlardan, KDV haric tutarlarla hesaplanir.",
                "Hammadde alimlari stok (150) olarak izlenir; gider tuketildikce SMM (620) olarak taninir.",
                "Vergi odemeleri faaliyet gideri degildir; nihai siniflandirma Mali Musavirin takdirindedir."));
        return r;
    }

    // ── KDV ozeti ──────────────────────────────────────────────

    public Map<String, Object> vatReport(String rawPeriod) {
        String period = rawPeriod == null || rawPeriod.isBlank() ? YearMonth.now().toString() : AccountingPeriodService.validatePeriod(rawPeriod);
        YearMonth ym = YearMonth.parse(period);
        List<SalesRecord> sales = salesRepository.findBySoldAtBetweenAndStatusOrderBySoldAtDesc(
                ym.atDay(1).atStartOfDay(), ym.plusMonths(1).atDay(1).atStartOfDay(), SalesRecord.STATUS_COMPLETED);

        Map<String, Map<String, BigDecimal>> output = new TreeMap<>();
        for (SalesRecord s : sales) {
            Map<String, BigDecimal> row = output.computeIfAbsent(s.getVatRate().stripTrailingZeros().toPlainString(), k -> newVatRow());
            row.merge("base", nz(s.getTotalPrice()).subtract(s.getVatAmount()), BigDecimal::add);
            row.merge("vat", s.getVatAmount(), BigDecimal::add);
        }
        Map<String, Map<String, BigDecimal>> input = new TreeMap<>();
        Map<String, Map<String, BigDecimal>> inputDraft = new TreeMap<>();
        for (Expense e : expenseRepository.findByPeriod(period)) {
            if (!recognized(e) || "TAX".equals(e.getSubType())) continue;
            Map<String, Map<String, BigDecimal>> target = e.isFinalized() ? input : inputDraft;
            Map<String, BigDecimal> row = target.computeIfAbsent(e.getVatRate().stripTrailingZeros().toPlainString(), k -> newVatRow());
            row.merge("base", e.getNetAmount(), BigDecimal::add);
            row.merge("vat", e.getVatAmount(), BigDecimal::add);
        }
        BigDecimal outVat = output.values().stream().map(m -> m.get("vat")).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal inVat = input.values().stream().map(m -> m.get("vat")).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal draftVat = inputDraft.values().stream().map(m -> m.get("vat")).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = outVat.subtract(inVat);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("period", period);
        r.put("outputVatByRate", output);
        r.put("inputVatByRate", input);
        r.put("inputVatPendingLedgerByRate", inputDraft);
        r.put("totalOutputVat", scale(outVat));
        r.put("totalInputVat", scale(inVat));
        r.put("inputVatAwaitingLedger", scale(draftVat));
        r.put("payableVat", scale(net.max(BigDecimal.ZERO)));
        r.put("carriedForwardVat", scale(net.min(BigDecimal.ZERO).abs()));
        r.put("disclaimer", "On izleme amaclidir. Resmi KDV beyannamesi Mali Musavir tarafindan hazirlanir; "
                + "indirilecek KDV yalnizca deftere islenmis (FINALIZED) belgelerden hesaplanmistir.");
        return r;
    }

    private static Map<String, BigDecimal> newVatRow() {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        m.put("base", BigDecimal.ZERO);
        m.put("vat", BigDecimal.ZERO);
        return m;
    }

    // ── Yevmiye fis dokumu (TDHP) ──────────────────────────────

    public Map<String, Object> journal(String rawPeriod) {
        String period = rawPeriod == null || rawPeriod.isBlank() ? YearMonth.now().toString() : AccountingPeriodService.validatePeriod(rawPeriod);
        YearMonth ym = YearMonth.parse(period);
        LocalDateTime from = ym.atDay(1).atStartOfDay();
        LocalDateTime to = ym.plusMonths(1).atDay(1).atStartOfDay();
        List<Map<String, Object>> entries = new ArrayList<>();
        int[] seq = {1};

        // 1) Gunluk satis fisleri
        Map<LocalDate, List<SalesRecord>> salesByDay = salesRepository
                .findBySoldAtBetweenAndStatusOrderBySoldAtDesc(from, to, SalesRecord.STATUS_COMPLETED).stream()
                .collect(Collectors.groupingBy(s -> s.getSoldAt().toLocalDate(), TreeMap::new, Collectors.toList()));
        salesByDay.forEach((day, list) -> {
            BigDecimal cash = BigDecimal.ZERO, card = BigDecimal.ZERO, meal = BigDecimal.ZERO, vat = BigDecimal.ZERO;
            Map<String, Map<String, BigDecimal>> sharesDay = mixedShares(list);
            for (SalesRecord s : list) {
                for (Map.Entry<String, BigDecimal> e : methodAmounts(s, sharesDay).entrySet()) {
                    switch (e.getKey()) {
                        case SalesService.CASH -> cash = cash.add(e.getValue());
                        case SalesService.MEAL_CARD -> meal = meal.add(e.getValue());
                        default -> card = card.add(e.getValue());
                    }
                }
                vat = vat.add(s.getVatAmount());
            }
            BigDecimal gross = cash.add(card).add(meal);
            List<Map<String, Object>> lines = new ArrayList<>();
            if (cash.signum() > 0) lines.add(line("100", "Kasa", cash, BigDecimal.ZERO));
            if (card.signum() > 0) lines.add(line("108", "Diger Hazir Degerler (POS)", card, BigDecimal.ZERO));
            if (meal.signum() > 0) lines.add(line("120", "Alicilar (Yemek Karti Sirketleri)", meal, BigDecimal.ZERO));
            lines.add(line("600", "Yurtici Satislar", BigDecimal.ZERO, gross.subtract(vat)));
            lines.add(line("391", "Hesaplanan KDV", BigDecimal.ZERO, vat));
            entries.add(entry(seq[0]++, day, "Gunluk satis hasilati (" + list.size() + " satir)", lines));

            BigDecimal dayCogs = nz(stockRepository.calculateCogsBetween(day.atStartOfDay(), day.plusDays(1).atStartOfDay()));
            if (dayCogs.signum() != 0) {
                entries.add(entry(seq[0]++, day, "Satilan mamul maliyeti (recete tuketimi)", List.of(
                        line("620", "Satilan Mamuller Maliyeti", dayCogs, BigDecimal.ZERO),
                        line("150", "Ilk Madde ve Malzeme", BigDecimal.ZERO, dayCogs))));
            }
        });

        // 2) Fire ve sayim farklari
        for (StockTransaction st : stockRepository.findByTimestampBetween(from, to)) {
            if (StockTransaction.WASTE.equals(st.getType()) && nz(st.getTotalAmount()).signum() > 0) {
                entries.add(entry(seq[0]++, st.getTimestamp().toLocalDate(),
                        "Fire/Zayiat: " + st.getItem().getName() + " - " + st.getReason(), List.of(
                                line("689", "Diger Olagandisi Gider ve Zararlar (Fire)", st.getTotalAmount(), BigDecimal.ZERO),
                                line("150", "Ilk Madde ve Malzeme", BigDecimal.ZERO, st.getTotalAmount()))));
            } else if (StockTransaction.ADJUSTMENT.equals(st.getType()) && nz(st.getTotalAmount()).signum() != 0) {
                BigDecimal v = st.getTotalAmount().abs();
                boolean loss = st.getTotalAmount().signum() < 0;
                entries.add(entry(seq[0]++, st.getTimestamp().toLocalDate(),
                        "Sayim farki: " + st.getItem().getName(), loss
                                ? List.of(line("689", "Diger Olagandisi Gider ve Zararlar (Sayim Eksigi)", v, BigDecimal.ZERO),
                                          line("150", "Ilk Madde ve Malzeme", BigDecimal.ZERO, v))
                                : List.of(line("150", "Ilk Madde ve Malzeme", v, BigDecimal.ZERO),
                                          line("679", "Diger Olagandisi Gelir ve Karlar (Sayim Fazlasi)", BigDecimal.ZERO, v))));
            }
        }

        // 3) Deftere islenmis giderler (yalnizca FINALIZED)
        for (Expense e : expenseRepository.findByPeriod(period)) {
            if (!e.isFinalized()) continue;
            ExpenseCatalog.ExpenseType type = ExpenseCatalog.find(e.getSubType());
            List<Map<String, Object>> lines = new ArrayList<>();
            lines.add(line(type.accountCode(), type.accountName(), e.getNetAmount(), BigDecimal.ZERO));
            if (e.getVatAmount().signum() > 0) lines.add(line("191", "Indirilecek KDV", e.getVatAmount(), BigDecimal.ZERO));
            lines.add(line("320", "Saticilar - " + (e.getCounterparty() != null ? e.getCounterparty() : "-"), BigDecimal.ZERO, e.getAmount()));
            entries.add(entry(seq[0]++, e.getExpenseDate(),
                    e.getTitle() + " (Belge: " + e.getInvoiceNumber() + ")", lines));
        }

        // 4) Odemeler (odeme tarihine gore)
        for (ExpensePayment p : paymentRepository.findByPaymentDateBetweenOrderByCreatedAtAsc(ym.atDay(1), ym.atEndOfMonth())) {
            String[] credit = switch (p.getMethod()) {
                case ExpensePayment.BANK_TRANSFER -> new String[]{"102", "Bankalar"};
                case ExpensePayment.CREDIT_CARD -> new String[]{"309", "Diger Mali Borclar (Sirket Kredi Karti)"};
                default -> new String[]{"100", "Kasa"};
            };
            String title = expenseRepository.findById(p.getExpenseId()).map(Expense::getTitle).orElse("Gider #" + p.getExpenseId());
            entries.add(entry(seq[0]++, p.getPaymentDate(), "Odeme: " + title, List.of(
                    line("320", "Saticilar", p.getAmount(), BigDecimal.ZERO),
                    line(credit[0], credit[1], BigDecimal.ZERO, p.getAmount()))));
        }

        entries.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDate) m.get("date"))
                .thenComparing(m -> (Integer) m.get("entryNo")));
        BigDecimal totalDebit = BigDecimal.ZERO, totalCredit = BigDecimal.ZERO;
        for (Map<String, Object> e : entries) {
            totalDebit = totalDebit.add((BigDecimal) e.get("totalDebit"));
            totalCredit = totalCredit.add((BigDecimal) e.get("totalCredit"));
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("period", period);
        r.put("entries", entries);
        r.put("totalDebit", scale(totalDebit));
        r.put("totalCredit", scale(totalCredit));
        r.put("balanced", totalDebit.compareTo(totalCredit) == 0);
        r.put("disclaimer", "Onerilen TDHP kodlariyla taslak fis dokumudur. Mali Musavir kendi muhasebe programina "
                + "aktarmadan once hesap eslestirmesini kontrol etmelidir.");
        return r;
    }

    private static Map<String, Object> line(String code, String name, BigDecimal debit, BigDecimal credit) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("accountCode", code);
        m.put("accountName", name);
        m.put("debit", scale(debit));
        m.put("credit", scale(credit));
        return m;
    }

    private static Map<String, Object> entry(int no, LocalDate date, String description, List<Map<String, Object>> lines) {
        BigDecimal d = lines.stream().map(l -> (BigDecimal) l.get("debit")).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal c = lines.stream().map(l -> (BigDecimal) l.get("credit")).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entryNo", no);
        m.put("date", date);
        m.put("description", description);
        m.put("lines", lines);
        m.put("totalDebit", d);
        m.put("totalCredit", c);
        m.put("balanced", d.compareTo(c) == 0);
        return m;
    }

    // ── Z raporu & kasa sayimi ─────────────────────────────────

    public Map<String, Object> zReport(LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        List<SalesRecord> all = salesRepository.findBySoldAtBetweenOrderBySoldAtDesc(day.atStartOfDay(), day.plusDays(1).atStartOfDay());
        List<SalesRecord> completed = all.stream().filter(s -> !s.isVoided()).toList();
        List<SalesRecord> voided = all.stream().filter(SalesRecord::isVoided).toList();

        Map<String, BigDecimal> byMethod = new LinkedHashMap<>();
        byMethod.put(SalesService.CASH, BigDecimal.ZERO);
        byMethod.put(SalesService.CREDIT_CARD, BigDecimal.ZERO);
        byMethod.put(SalesService.MEAL_CARD, BigDecimal.ZERO);
        Map<String, Map<String, BigDecimal>> vatByRate = new TreeMap<>();
        Map<String, Map<String, BigDecimal>> sharesZ = mixedShares(completed);
        for (SalesRecord s : completed) {
            methodAmounts(s, sharesZ).forEach((m, v) -> byMethod.merge(m, v, BigDecimal::add));
            Map<String, BigDecimal> row = vatByRate.computeIfAbsent(s.getVatRate().stripTrailingZeros().toPlainString(), k -> newVatRow());
            row.merge("base", nz(s.getTotalPrice()).subtract(s.getVatAmount()), BigDecimal::add);
            row.merge("vat", s.getVatAmount(), BigDecimal::add);
        }
        BigDecimal gross = byMethod.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cashPaidOut = nz(paymentRepository.sumByDateAndMethod(day, ExpensePayment.CASH));

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("date", day);
        r.put("receiptCount", completed.stream().map(SalesRecord::getOrderNo).distinct().count());
        r.put("lineCount", completed.size());
        r.put("grossSales", scale(gross));
        r.put("salesByPaymentMethod", byMethod);
        r.put("vatByRate", vatByRate);
        r.put("totalVat", scale(completed.stream().map(SalesRecord::getVatAmount).reduce(BigDecimal.ZERO, BigDecimal::add)));
        r.put("voidCount", voided.size());
        r.put("voidAmount", scale(voided.stream().map(SalesRecord::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add)));
        r.put("cashSales", scale(byMethod.get(SalesService.CASH)));
        r.put("cashPaidOut", scale(cashPaidOut));
        r.put("expectedCashExcludingFloat", scale(byMethod.get(SalesService.CASH).subtract(cashPaidOut)));
        r.put("closings", cashClosingRepository.findByBusinessDateOrderByClosedAtAsc(day));
        r.put("disclaimer", "Sistem Z ozeti; yazar kasa / ODEO cihazinin resmi Z raporu ile karsilastirilmalidir.");
        return r;
    }

    @Transactional
    public CashClosing createCashClosing(LocalDate date, BigDecimal openingFloat, BigDecimal countedCash, String note) {
        LocalDate day = date != null ? date : LocalDate.now();
        if (day.isAfter(LocalDate.now())) throw new IllegalArgumentException("Ileri tarihli kasa sayimi yapilamaz");
        if (countedCash == null || countedCash.signum() < 0) throw new IllegalArgumentException("Sayilan nakit 0 veya daha buyuk olmalidir");
        BigDecimal opening = openingFloat == null ? BigDecimal.ZERO : openingFloat;
        if (opening.signum() < 0) throw new IllegalArgumentException("Acilis kasasi (devir) negatif olamaz");
        periodService.assertOpen(Expense.periodOf(day));

        Map<String, Object> z = zReport(day);
        @SuppressWarnings("unchecked")
        Map<String, BigDecimal> byMethod = (Map<String, BigDecimal>) z.get("salesByPaymentMethod");
        BigDecimal cashSales = (BigDecimal) z.get("cashSales");
        BigDecimal paidOut = (BigDecimal) z.get("cashPaidOut");
        BigDecimal expected = opening.add(cashSales).subtract(paidOut).setScale(2, RoundingMode.HALF_UP);
        BigDecimal counted = countedCash.setScale(2, RoundingMode.HALF_UP);
        BigDecimal diff = counted.subtract(expected);

        CashClosing c = new CashClosing();
        c.setBusinessDate(day);
        c.setOpeningFloat(opening.setScale(2, RoundingMode.HALF_UP));
        c.setCashSales(cashSales);
        c.setCashPaidOut(paidOut);
        c.setExpectedCash(expected);
        c.setCountedCash(counted);
        c.setDifference(diff);
        c.setCardSales(scale(byMethod.get(SalesService.CREDIT_CARD)));
        c.setMealCardSales(scale(byMethod.get(SalesService.MEAL_CARD)));
        c.setClosedBy(currentUserService.displayName());
        c.setClosedAt(LocalDateTime.now());
        c.setNote(note == null ? null : note.trim());
        c.setStatus(CashClosing.PENDING_REVIEW);
        // Kor sayim: kasiyer beklenen tutari gormeden sayar; ilk sayim her zaman kaydedilir (fark ogrenilip
        // sayim degistirilemez). Fark olusursa aciklama kayittan sonra eklenir (addCashClosingExplanation).
        CashClosing saved = cashClosingRepository.save(c);

        auditService.log("CASH_CLOSING", "CASH_CLOSING", saved.getId(), null, null,
                String.format("%s | beklenen %s | sayilan %s | fark %s", day, expected, counted, diff));
        notificationService.notify(Permissions.rolesWith(Permissions.P.CASH_CLOSING_REVIEW),
                "Kasa Sayimi Mutabakat Bekliyor: " + day,
                String.format("%s, %s tarihli gun sonu kasa sayimini girdi. Beklenen %s TL, sayilan %s TL%s. "
                                + "Z ozeti ve POS / yemek karti mutabakatini yapip onaylayin.",
                        currentUserService.displayName(), day, ExpenseService.fmt(expected), ExpenseService.fmt(counted),
                        diff.signum() != 0 ? ", fark " + ExpenseService.fmt(diff) + " TL" : ""),
                currentUserService.displayName(), "CASH_CLOSING", saved.getId(), "/accounting", diff.signum() != 0 ? "WARNING" : "INFO");
        if (diff.signum() != 0) {
            notificationService.notify(List.of(AppRoles.MANAGER),
                    (diff.signum() < 0 ? "Kasa Acigi: " : "Kasa Fazlasi: ") + ExpenseService.fmt(diff.abs()) + " TL",
                    String.format("%s tarihli kasa sayiminda %s TL %s tespit edildi. Beklenen: %s TL, sayilan: %s TL. Aciklama: %s",
                            day, ExpenseService.fmt(diff.abs()), diff.signum() < 0 ? "acik" : "fazla",
                            ExpenseService.fmt(expected), ExpenseService.fmt(counted), c.getNote()),
                    currentUserService.displayName(), "CASH_CLOSING", saved.getId(), "/approvals", "WARNING");
        }
        return saved;
    }

    /**
     * Kor sayim sonrasi fark aciklamasi: yalnizca sayimi giren kisi, mutabakat sonuclanmadan ekleyebilir.
     * Sayilan tutar degistirilemez; Muhasebe aciklamayla birlikte mutabakat yapar.
     */
    @Transactional
    public CashClosing addCashClosingExplanation(Long id, String explanation) {
        CashClosing c = cashClosingRepository.findById(id)
                .orElseThrow(() -> new com.gastrosync.exception.ResourceNotFoundException("Kasa sayimi bulunamadi: " + id));
        if (!currentUserService.displayName().equalsIgnoreCase(c.getClosedBy())) {
            throw new org.springframework.security.access.AccessDeniedException("Fark aciklamasini yalnizca sayimi giren kisi ekleyebilir");
        }
        if (!CashClosing.PENDING_REVIEW.equals(c.getStatus())) {
            throw new BusinessRuleException("Mutabakati sonuclanmis sayima aciklama eklenemez");
        }
        String clean = explanation == null ? "" : explanation.trim();
        if (clean.length() < 5) throw new IllegalArgumentException("Fark aciklamasi en az 5 karakter olmalidir");
        if (clean.length() > 1000) throw new IllegalArgumentException("Aciklama en fazla 1000 karakter olabilir");
        String old = c.getNote();
        c.setNote(old == null || old.isBlank() ? clean : old + " | " + clean);
        CashClosing saved = cashClosingRepository.save(c);
        auditService.log("CASH_CLOSING_EXPLAINED", "CASH_CLOSING", id, null, null,
                c.getBusinessDate() + " | fark " + c.getDifference() + " | " + clean);
        notificationService.notify(Permissions.rolesWith(Permissions.P.CASH_CLOSING_REVIEW),
                "Kasa Farki Aciklandi: " + c.getBusinessDate(),
                String.format("%s, %s TL kasa farki icin aciklama girdi: %s", currentUserService.displayName(),
                        ExpenseService.fmt(nz(c.getDifference())), clean),
                currentUserService.displayName(), "CASH_CLOSING", id, "/accounting", "INFO");
        return saved;
    }

    /**
     * Muhasebe mutabakati: kasiyerin sayimini Z ozeti, POS slipleri ve yemek karti raporlariyla karsilastirip
     * onaylar (RECONCILED) veya gerekceyle yeniden sayim ister (REJECTED). Sayimi giren kisi onaylayamaz.
     */
    @Transactional
    public CashClosing reviewCashClosing(Long id, boolean approve, String note) {
        if (!currentUserService.can(Permissions.P.CASH_CLOSING_REVIEW)) {
            throw new org.springframework.security.access.AccessDeniedException("Kasa sayimi mutabakati Muhasebe yetkisindedir");
        }
        CashClosing c = cashClosingRepository.findById(id)
                .orElseThrow(() -> new com.gastrosync.exception.ResourceNotFoundException("Kasa sayimi bulunamadi: " + id));
        if (!CashClosing.PENDING_REVIEW.equals(c.getStatus())) {
            throw new BusinessRuleException("Bu kasa sayimi zaten sonuclandirildi (" + c.getStatus() + ")");
        }
        if (currentUserService.displayName().equalsIgnoreCase(c.getClosedBy())) {
            throw new BusinessRuleException("Gorevler ayriligi: kendi girdiginiz kasa sayimini onaylayamazsiniz");
        }
        if (approve && nz(c.getDifference()).signum() != 0 && (c.getNote() == null || c.getNote().trim().length() < 5)) {
            throw new BusinessRuleException("Kasa farki aciklamasi girilmeden sayim onaylanamaz; gerekirse yeniden sayim isteyin");
        }
        String clean = note == null ? null : note.trim();
        if (!approve && (clean == null || clean.length() < 10)) {
            throw new IllegalArgumentException("Yeniden sayim gerekcesi zorunludur (en az 10 karakter)");
        }
        if (clean != null && clean.length() > 500) throw new IllegalArgumentException("Not en fazla 500 karakter olabilir");
        periodService.assertOpen(Expense.periodOf(c.getBusinessDate()));
        c.setStatus(approve ? CashClosing.RECONCILED : CashClosing.REJECTED);
        c.setReviewedBy(currentUserService.displayName());
        c.setReviewedAt(LocalDateTime.now());
        c.setReviewNote(clean == null || clean.isEmpty() ? null : clean);
        CashClosing saved = cashClosingRepository.save(c);
        auditService.log(approve ? "CASH_CLOSING_RECONCILED" : "CASH_CLOSING_REJECTED", "CASH_CLOSING", id,
                CashClosing.PENDING_REVIEW, saved.getStatus(),
                c.getBusinessDate() + " | fark " + c.getDifference() + (clean != null ? " | " + clean : ""));
        notificationService.notify(List.of(AppRoles.CASHIER, AppRoles.MANAGER),
                (approve ? "Kasa Sayimi Onaylandi: " : "Yeniden Sayim Istendi: ") + c.getBusinessDate(),
                approve
                        ? String.format("%s, %s tarihli kasa sayimini mutabik buldu.", currentUserService.displayName(), c.getBusinessDate())
                        : String.format("%s, %s tarihli kasa sayimini reddetti. Gerekce: %s. Kasayi yeniden sayip tutanak girin.",
                                currentUserService.displayName(), c.getBusinessDate(), clean),
                currentUserService.displayName(), "CASH_CLOSING", id, "/pos", approve ? "INFO" : "WARNING");
        return saved;
    }

    /**
     * Kasa ve gelir raporu (Muhasebe): gunluk (bir ay), aylik (bir yil) veya yillik (son 5 yil) dokum.
     * Satislar KDV dahil odeme turune gore, odemeler (kasa / banka / kart) gider odeme kayitlarindan gelir.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> cashReport(String rawGranularity, String rawPeriod) {
        String granularity = rawGranularity == null ? "day" : rawGranularity.trim().toLowerCase(java.util.Locale.ROOT);
        LocalDate today = LocalDate.now();
        LocalDate start;
        LocalDate end;
        String label;
        switch (granularity) {
            case "month" -> {
                int year = rawPeriod != null && rawPeriod.matches("\\d{4}") ? Integer.parseInt(rawPeriod) : today.getYear();
                start = LocalDate.of(year, 1, 1);
                end = LocalDate.of(year, 12, 31);
                label = String.valueOf(year);
            }
            case "year" -> {
                start = LocalDate.of(today.getYear() - 4, 1, 1);
                end = LocalDate.of(today.getYear(), 12, 31);
                label = start.getYear() + "-" + end.getYear();
            }
            case "day" -> {
                YearMonth ym = rawPeriod != null && rawPeriod.matches("\\d{4}-\\d{2}") ? YearMonth.parse(rawPeriod) : YearMonth.from(today);
                start = ym.atDay(1);
                end = ym.atEndOfMonth();
                label = ym.toString();
            }
            default -> throw new IllegalArgumentException("Gecersiz rapor tipi: " + rawGranularity + " (day, month, year)");
        }
        if (end.isAfter(today)) end = today;
        if (start.isAfter(end)) start = end;

        java.util.function.Function<LocalDate, String> keyOf = switch (granularity) {
            case "month" -> d -> YearMonth.from(d).toString();
            case "year" -> d -> String.valueOf(d.getYear());
            default -> LocalDate::toString;
        };
        Map<String, Map<String, BigDecimal>> rows = new TreeMap<>();
        Map<String, Long> receipts = new TreeMap<>();
        for (LocalDate d = start; !d.isAfter(end); d = granularity.equals("day") ? d.plusDays(1)
                : granularity.equals("month") ? d.plusMonths(1).withDayOfMonth(1) : d.plusYears(1).withDayOfYear(1)) {
            rows.put(keyOf.apply(d), newCashRow());
        }
        java.util.Map<String, java.util.Set<String>> orderSets = new java.util.HashMap<>();
        List<SalesRecord> cashList = salesRepository.findBySoldAtBetweenOrderBySoldAtDesc(start.atStartOfDay(), end.plusDays(1).atStartOfDay());
        Map<String, Map<String, BigDecimal>> sharesCash = mixedShares(cashList);
        for (SalesRecord s : cashList) {
            if (s.isVoided() || s.getSoldAt() == null) continue;
            String key = keyOf.apply(s.getSoldAt().toLocalDate());
            Map<String, BigDecimal> row = rows.computeIfAbsent(key, k -> newCashRow());
            BigDecimal total = nz(s.getTotalPrice());
            row.merge("grossSales", total, BigDecimal::add);
            row.merge("vat", nz(s.getVatAmount()), BigDecimal::add);
            for (Map.Entry<String, BigDecimal> e : methodAmounts(s, sharesCash).entrySet()) {
                String m = e.getKey();
                row.merge(SalesService.CASH.equals(m) ? "cashSales" : SalesService.MEAL_CARD.equals(m) ? "mealCardSales" : "cardSales",
                        e.getValue(), BigDecimal::add);
            }
            orderSets.computeIfAbsent(key, k -> new java.util.HashSet<>()).add(s.getOrderNo());
        }
        orderSets.forEach((k, v) -> receipts.put(k, (long) v.size()));
        for (ExpensePayment p : paymentRepository.findByPaymentDateBetweenOrderByCreatedAtAsc(start, end)) {
            if (p.getPaymentDate() == null) continue;
            Map<String, BigDecimal> row = rows.computeIfAbsent(keyOf.apply(p.getPaymentDate()), k -> newCashRow());
            BigDecimal amt = nz(p.getAmount());
            row.merge("payments", amt, BigDecimal::add);
            row.merge(ExpensePayment.CASH.equals(p.getMethod()) ? "cashPayments"
                    : ExpensePayment.BANK_TRANSFER.equals(p.getMethod()) ? "bankPayments" : "cardPayments", amt, BigDecimal::add);
        }
        for (CashClosing c : cashClosingRepository.findByBusinessDateBetweenOrderByBusinessDateDescClosedAtDesc(start, end)) {
            Map<String, BigDecimal> row = rows.computeIfAbsent(keyOf.apply(c.getBusinessDate()), k -> newCashRow());
            row.merge("countDifference", nz(c.getDifference()), BigDecimal::add);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, BigDecimal> totals = newCashRow();
        long totalReceipts = 0;
        for (Map.Entry<String, Map<String, BigDecimal>> e : rows.entrySet()) {
            Map<String, BigDecimal> r = e.getValue();
            r.put("netSales", r.get("grossSales").subtract(r.get("vat")));
            r.put("netCashFlow", r.get("cashSales").subtract(r.get("cashPayments")));
            r.put("netFlow", r.get("grossSales").subtract(r.get("payments")));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("period", e.getKey());
            long rc = receipts.getOrDefault(e.getKey(), 0L);
            row.put("receiptCount", rc);
            totalReceipts += rc;
            r.forEach((k, v) -> {
                row.put(k, scale(v));
                totals.merge(k, v, BigDecimal::add);
            });
            out.add(row);
        }
        Map<String, Object> totalRow = new LinkedHashMap<>();
        totalRow.put("receiptCount", totalReceipts);
        totals.forEach((k, v) -> totalRow.put(k, scale(v)));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("granularity", granularity);
        result.put("label", label);
        result.put("from", start);
        result.put("to", end);
        result.put("rows", out);
        result.put("totals", totalRow);
        result.put("note", "Satislar KDV dahil tahsilattir; odemeler gider odeme kayitlarindan (kasa / banka / kart) alinir.");
        return result;
    }

    private static Map<String, BigDecimal> newCashRow() {
        Map<String, BigDecimal> r = new LinkedHashMap<>();
        for (String k : List.of("grossSales", "vat", "netSales", "cashSales", "cardSales", "mealCardSales",
                "payments", "cashPayments", "bankPayments", "cardPayments", "netCashFlow", "netFlow", "countDifference")) {
            r.put(k, BigDecimal.ZERO);
        }
        return r;
    }

    public List<CashClosing> cashClosings(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(30);
        if (start.isAfter(end)) throw new BusinessRuleException("Baslangic tarihi bitis tarihinden sonra olamaz");
        return cashClosingRepository.findByBusinessDateBetweenOrderByBusinessDateDescClosedAtDesc(start, end);
    }

    // ── Dashboard (geriye donuk) ───────────────────────────────

    public Map<String, Object> dashboardSummary() {
        Map<String, Object> month = periodSummary(null);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("totalRevenue", month.get("netRevenue"));
        r.put("grossRevenue", month.get("grossRevenue"));
        r.put("totalCost", month.get("cogs"));
        r.put("netProfit", month.get("grossProfit"));
        r.put("operatingProfit", month.get("operatingProfit"));
        r.put("foodCostPercent", month.get("foodCostPercent"));
        r.put("targetFoodCostPercent", targetFoodCost);
        r.put("criticalStockCount", month.get("criticalStockCount"));
        r.put("period", month.get("period"));
        return r;
    }

    // ── Yardimcilar ────────────────────────────────────────────

    private static BigDecimal pct(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0) return BigDecimal.ZERO.setScale(1);
        return part.multiply(HUNDRED).divide(whole, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().map(ReportService::nz).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal scale(BigDecimal v) {
        return nz(v).setScale(2, RoundingMode.HALF_UP);
    }
}
