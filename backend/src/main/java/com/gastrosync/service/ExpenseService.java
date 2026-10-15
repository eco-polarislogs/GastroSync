package com.gastrosync.service;

import com.gastrosync.model.Expense;
import com.gastrosync.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    public ExpenseService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
        initDefaultExpensesIfEmpty();
    }

    private void initDefaultExpensesIfEmpty() {
        if (expenseRepository.count() == 0) {
            String currentPeriod = LocalDate.now().getYear() + "-" + String.format("%02d", LocalDate.now().getMonthValue());
            LocalDate today = LocalDate.now();

            // 1. Sabit Giderler (Kira, İşçilik, Mali Müşavir)
            expenseRepository.save(new Expense("Merkez Restoran Kirası", "FIXED", "RENT", new BigDecimal("45000.00"), currentPeriod, today, "Sistem / Muhasebe", "Ana cadde şube aylık kira bedeli"));
            expenseRepository.save(new Expense("Mutfak & Servis Personel Maaşları", "FIXED", "LABOR", new BigDecimal("85000.00"), currentPeriod, today, "Sistem / Muhasebe", "1 Şef, 2 Aşçı, 3 Garson net maaş bordrosu"));
            expenseRepository.save(new Expense("Mali Müşavirlik & Danışmanlık Ücreti", "FIXED", "ACCOUNTANT", new BigDecimal("8500.00"), currentPeriod, today, "Sistem / Muhasebe", "Aylık defter tutma ve vergi beyan danışmanlığı"));

            // 2. Değişken Giderler (Elektrik, Su, Doğalgaz, Telefon, İnternet, Vergi, Sigorta SGK, Sarf Malzeme, Lojistik, Reklam, Tadilat)
            expenseRepository.save(new Expense("Sanayi Tipi Mutfak Elektrik Faturası", "VARIABLE", "ELECTRICITY", new BigDecimal("14200.00"), currentPeriod, today, "Sistem / Muhasebe", "Soğuk hava depoları ve pişirme fırınları", false, true, true));
            expenseRepository.save(new Expense("Şebeke Su Faturası & Arıtma", "VARIABLE", "WATER", new BigDecimal("3800.00"), currentPeriod, today, "Sistem / Muhasebe", "Bulaşıkhane ve genel su tüketimi", false, true, true));
            expenseRepository.save(new Expense("Endüstriyel Ocak Doğalgaz Tüketimi", "VARIABLE", "GAS", new BigDecimal("9600.00"), currentPeriod, today, "Sistem / Muhasebe", "Kuzine ve fırın hattı", false, true, true));
            expenseRepository.save(new Expense("Restoran Sabit Hat & Rezervasyon Telefonları", "VARIABLE", "PHONE", new BigDecimal("850.00"), currentPeriod, today, "Sistem / Muhasebe", "Müşteri iletişim hattı", false, true, true));
            expenseRepository.save(new Expense("Fiber İnternet & POS Terminal Hattı", "VARIABLE", "INTERNET", new BigDecimal("1250.00"), currentPeriod, today, "Sistem / Muhasebe", "POS ve restoran içi Wi-Fi", false, true, true));
            expenseRepository.save(new Expense("KDV & Geçici Kurumlar Vergisi", "VARIABLE", "TAX", new BigDecimal("18500.00"), currentPeriod, today, "Sistem / Muhasebe", "Dönemsel vergi tahakkukları", false, true, true));
            expenseRepository.save(new Expense("Personel SGK & Prim Ödemeleri", "VARIABLE", "SGK", new BigDecimal("27500.00"), currentPeriod, today, "Sistem / Muhasebe", "Aylık SGK işveren ve çalışan primi", false, true, true));
            expenseRepository.save(new Expense("Ambalaj, Peçete & Temizlik Sarf Malzemeleri", "VARIABLE", "CONSUMABLES", new BigDecimal("6400.00"), currentPeriod, today, "Sistem / Muhasebe", "Paket servis kutuları, deterjan ve hijyen ürünleri", false, true, true));
            expenseRepository.save(new Expense("Soğuk Zincir Et & Sebze Lojistik Nakliyesi", "VARIABLE", "LOGISTICS", new BigDecimal("7500.00"), currentPeriod, today, "Sistem / Muhasebe", "Toptancı hali ve mezbaha lojistik nakliye bedeli", false, true, true));
            expenseRepository.save(new Expense("Instagram & Yerel Yemek Rehberi Reklamı", "VARIABLE", "MARKETING", new BigDecimal("5000.00"), currentPeriod, today, "Sistem / Muhasebe", "Menü lansmanı ve sosyal medya reklam bütçesi", false, true, false));
            expenseRepository.save(new Expense("Mutfak Havalandırma & Davlumbaz Bakım/Tadilat", "VARIABLE", "RENOVATION", new BigDecimal("8500.00"), currentPeriod, today, "Sistem / Muhasebe", "Periyodik baca ve davlumbaz filtre yenilemesi", false, true, true));
        }
    }

    public List<Expense> getAllExpenses() {
        return expenseRepository.findAllByOrderByExpenseDateDescIdDesc();
    }

    public List<Expense> getExpensesByCategory(String category) {
        return expenseRepository.findByCategory(category.toUpperCase());
    }

    public Optional<Expense> getExpenseById(Long id) {
        return expenseRepository.findById(id);
    }

    public Expense saveExpense(Expense expense) {
        if (expense.getExpenseDate() == null) {
            expense.setExpenseDate(LocalDate.now());
        }
        if (expense.getPeriod() == null || expense.getPeriod().isBlank()) {
            expense.setPeriod(expense.getExpenseDate().getYear() + "-" + String.format("%02d", expense.getExpenseDate().getMonthValue()));
        }
        return expenseRepository.save(expense);
    }

    public void deleteExpense(Long id) {
        expenseRepository.deleteById(id);
    }

    public Map<String, Object> getExpenseSummary() {
        List<Expense> all = expenseRepository.findAll();
        BigDecimal totalFixed = BigDecimal.ZERO;
        BigDecimal totalVariable = BigDecimal.ZERO;

        Map<String, BigDecimal> fixedBreakdown = new HashMap<>();
        Map<String, BigDecimal> variableBreakdown = new HashMap<>();

        for (Expense e : all) {
            BigDecimal amt = e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO;
            if ("FIXED".equalsIgnoreCase(e.getCategory())) {
                totalFixed = totalFixed.add(amt);
                fixedBreakdown.put(e.getSubType(), fixedBreakdown.getOrDefault(e.getSubType(), BigDecimal.ZERO).add(amt));
            } else {
                totalVariable = totalVariable.add(amt);
                variableBreakdown.put(e.getSubType(), variableBreakdown.getOrDefault(e.getSubType(), BigDecimal.ZERO).add(amt));
            }
        }

        BigDecimal grandTotal = totalFixed.add(totalVariable);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalFixed", totalFixed);
        summary.put("totalVariable", totalVariable);
        summary.put("grandTotal", grandTotal);
        summary.put("fixedBreakdown", fixedBreakdown);
        summary.put("variableBreakdown", variableBreakdown);
        summary.put("totalExpenseCount", all.size());
        return summary;
    }
}
