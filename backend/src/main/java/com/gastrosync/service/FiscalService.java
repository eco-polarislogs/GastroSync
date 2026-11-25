package com.gastrosync.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.FiscalDocument;
import com.gastrosync.model.SalesRecord;
import com.gastrosync.model.TableCheck;
import com.gastrosync.repository.FiscalDocumentRepository;
import com.gastrosync.repository.SalesRecordRepository;
import com.gastrosync.repository.TableCheckRepository;
import com.gastrosync.security.CurrentUserService;

/**
 * Mali belge (e-Arsiv fatura / OKC fisi) islemleri.
 *
 * e-Arsiv: UBL-TR 1.2 fatura XML'i ve GIB formatinda belge numarasi (3 harf + yil + 9 hane) burada uretilir.
 * GIB'e iletim yalnizca ozel entegrator uzerinden yapilabilir; saglayici "gastrosync.fiscal.provider" ile secilir:
 *   NONE - XML taslak olarak saklanir (entegrator paneline yuklenebilir)  [varsayilan]
 *   TEST - kabul simule edilir (demo / egitim)
 * Gercek entegrator baglantisi {@link #send} noktasina eklenir (sozlesme ve API bilgisi gerekir).
 *
 * OKC: Yeni nesil yazar kasada kesilen fisin numarasi adisyona baglanir; Z raporunda mali belgesiz adisyonlar listelenir.
 */
@Service
@Transactional
public class FiscalService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final FiscalDocumentRepository documentRepository;
    private final TableCheckRepository checkRepository;
    private final SalesRecordRepository salesRepository;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final String provider;
    private final String prefix;
    private final String companyTitle;
    private final String companyVkn;
    private final String companyTaxOffice;
    private final String companyAddress;
    private final String companyCity;

    public FiscalService(FiscalDocumentRepository documentRepository, TableCheckRepository checkRepository,
                         SalesRecordRepository salesRepository, AuditService auditService, CurrentUserService currentUserService,
                         @Value("${gastrosync.fiscal.provider:NONE}") String provider,
                         @Value("${gastrosync.fiscal.earsiv-prefix:GSA}") String prefix,
                         @Value("${gastrosync.company.title:GastroSync Demo Restoran}") String companyTitle,
                         @Value("${gastrosync.company.vkn:1234567890}") String companyVkn,
                         @Value("${gastrosync.company.tax-office:Demo Vergi Dairesi}") String companyTaxOffice,
                         @Value("${gastrosync.company.address:Demo Mah. Ornek Cad. No:1}") String companyAddress,
                         @Value("${gastrosync.company.city:Istanbul}") String companyCity) {
        this.documentRepository = documentRepository;
        this.checkRepository = checkRepository;
        this.salesRepository = salesRepository;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.provider = provider == null ? "NONE" : provider.trim().toUpperCase();
        String p = prefix == null ? "GSA" : prefix.trim().toUpperCase();
        if (!p.matches("^[A-Z0-9]{3}$")) throw new IllegalStateException("gastrosync.fiscal.earsiv-prefix 3 karakter (harf/rakam) olmalidir");
        this.prefix = p;
        this.companyTitle = companyTitle;
        this.companyVkn = companyVkn;
        this.companyTaxOffice = companyTaxOffice;
        this.companyAddress = companyAddress;
        this.companyCity = companyCity;
    }

    public Map<String, Object> status() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("provider", provider);
        m.put("liveSending", false);
        m.put("earsivPrefix", prefix);
        m.put("companyTitle", companyTitle);
        m.put("companyVkn", companyVkn);
        m.put("companyConfigured", companyConfigured());
        m.put("message", switch (provider) {
            case "TEST" -> "Test modu: e-Arsiv belgeleri kabul edilmis gibi isaretlenir (GIB'e gonderilmez).";
            default -> "Entegrator tanimli degil: e-Arsiv XML'i uretilir ve taslak olarak saklanir; entegrator paneline yuklenebilir.";
        });
        return m;
    }

    // ── e-Arsiv ────────────────────────────────────────────────

    private boolean companyConfigured() {
        return companyVkn != null && companyVkn.trim().matches("^[0-9]{10,11}$") && companyTitle != null && !companyTitle.isBlank();
    }

    public FiscalDocument issueEArsiv(Long checkId, String buyerName, String buyerTaxId, String buyerTaxOffice, String buyerEmail) {
        if (!companyConfigured()) {
            throw new BusinessRuleException("Isletme unvani / VKN tanimli degil. Yonetici GASTROSYNC_COMPANY_TITLE ve GASTROSYNC_COMPANY_VKN ayarlarini girmelidir.");
        }
        TableCheck c = paidCheck(checkId);
        for (FiscalDocument d : documentRepository.findByCheckIdOrderByCreatedAtAsc(c.getId())) {
            if (FiscalDocument.E_ARSIV.equals(d.getType()) && !FiscalDocument.CANCELLED.equals(d.getStatus())
                    && !FiscalDocument.ERROR.equals(d.getStatus())) {
                throw new BusinessRuleException("Bu adisyon icin e-Arsiv fatura zaten duzenlendi: " + d.getDocumentNo());
            }
        }
        String taxId = buyerTaxId == null ? null : buyerTaxId.replaceAll("\\s", "");
        if (taxId != null && taxId.isEmpty()) taxId = null;
        if (taxId != null && !taxId.matches("^\\d{10,11}$")) throw new IllegalArgumentException("VKN 10, TCKN 11 haneli olmalidir");
        if (taxId != null && taxId.length() == 10 && (buyerTaxOffice == null || buyerTaxOffice.isBlank())) {
            throw new IllegalArgumentException("VKN ile fatura icin vergi dairesi zorunludur");
        }
        String name = buyerName == null || buyerName.isBlank() ? "Nihai Tuketici" : buyerName.trim();
        if (name.length() > 200) throw new IllegalArgumentException("Alici unvani en fazla 200 karakter olabilir");
        String email = buyerEmail == null || buyerEmail.isBlank() ? null : buyerEmail.trim();
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new IllegalArgumentException("E-posta adresi gecersiz");

        List<SalesRecord> lines = salesRepository.findByOrderNo(c.getCheckNo()).stream()
                .filter(s -> !s.isVoided() && !Boolean.TRUE.equals(s.getComp()))
                .toList();
        if (lines.isEmpty()) throw new BusinessRuleException("Adisyonun ucretli satis satiri yok; fatura duzenlenemez.");

        FiscalDocument d = new FiscalDocument();
        d.setCheckId(c.getId());
        d.setCheckNo(c.getCheckNo());
        d.setType(FiscalDocument.E_ARSIV);
        d.setUuid(UUID.randomUUID().toString().toUpperCase());
        d.setDocumentNo(nextDocumentNo(LocalDate.now().getYear()));
        d.setBuyerName(name);
        d.setBuyerTaxId(taxId == null ? "11111111111" : taxId);
        d.setBuyerTaxOffice(buyerTaxOffice == null || buyerTaxOffice.isBlank() ? null : buyerTaxOffice.trim());
        d.setBuyerEmail(email);
        BigDecimal total = lines.stream().map(s -> nz(s.getTotalPrice())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal vat = lines.stream().map(SalesRecord::getVatAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        d.setTotal(total.setScale(2, RoundingMode.HALF_UP));
        d.setVatTotal(vat.setScale(2, RoundingMode.HALF_UP));
        d.setCreatedAt(LocalDateTime.now());
        d.setCreatedBy(currentUserService.require().displayName());
        d.setXml(ublInvoice(d, lines));
        d.setProvider(provider);
        send(d);
        FiscalDocument saved = documentRepository.save(d);
        auditService.log("FISCAL_EARSIV_ISSUED", "CHECK", c.getId(), null, saved.getStatus(),
                String.format("%s | %s | %s TL | alici %s", saved.getDocumentNo(), c.getCheckNo(), saved.getTotal().toPlainString(), name));
        return saved;
    }

    /** Entegrator gonderim noktasi. Gercek entegrator (UBL imzalama + GIB iletimi) burada baglanir. */
    private void send(FiscalDocument d) {
        if ("TEST".equals(provider)) {
            d.setStatus(FiscalDocument.ACCEPTED);
            d.setProviderRef("TEST-" + d.getUuid().substring(0, 8));
            d.setSentAt(LocalDateTime.now());
        } else {
            d.setStatus(FiscalDocument.DRAFT);
        }
    }

    public FiscalDocument cancel(Long documentId, String reason) {
        FiscalDocument d = documentRepository.findById(documentId).orElseThrow(() -> new ResourceNotFoundException("Belge bulunamadi"));
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Iptal gerekcesi zorunludur");
        if (FiscalDocument.CANCELLED.equals(d.getStatus())) throw new BusinessRuleException("Belge zaten iptal edilmis");
        if (FiscalDocument.E_ARSIV.equals(d.getType()) && d.getCreatedAt().toLocalDate().isBefore(LocalDate.now().minusDays(7))) {
            throw new BusinessRuleException("e-Arsiv fatura duzenlendikten 7 gun sonra iptal edilemez; iade faturasi duzenleyin.");
        }
        d.setStatus(FiscalDocument.CANCELLED);
        d.setCancelReason(reason.trim().length() > 300 ? reason.trim().substring(0, 300) : reason.trim());
        FiscalDocument saved = documentRepository.save(d);
        auditService.log("FISCAL_DOCUMENT_CANCELLED", "CHECK", d.getCheckId(), null, FiscalDocument.CANCELLED,
                d.getType() + " " + d.getDocumentNo() + " | gerekce: " + saved.getCancelReason());
        return saved;
    }

    // ── OKC ────────────────────────────────────────────────────

    public FiscalDocument recordOkc(Long checkId, String receiptNo, String zNo) {
        TableCheck c = paidCheck(checkId);
        String no = receiptNo == null ? "" : receiptNo.trim();
        if (!no.matches("^[0-9A-Za-z-]{1,20}$")) throw new IllegalArgumentException("OKC fis numarasi zorunludur (en fazla 20 karakter)");
        String z = zNo == null || zNo.isBlank() ? null : zNo.trim();
        if (z != null && !z.matches("^[0-9]{1,10}$")) throw new IllegalArgumentException("Z numarasi yalnizca rakam olmalidir");
        for (FiscalDocument d : documentRepository.findByCheckIdOrderByCreatedAtAsc(c.getId())) {
            if (FiscalDocument.OKC.equals(d.getType()) && !FiscalDocument.CANCELLED.equals(d.getStatus())) {
                throw new BusinessRuleException("Bu adisyona OKC fisi zaten baglandi: " + d.getDocumentNo());
            }
        }
        FiscalDocument d = new FiscalDocument();
        d.setCheckId(c.getId());
        d.setCheckNo(c.getCheckNo());
        d.setType(FiscalDocument.OKC);
        d.setStatus(FiscalDocument.RECORDED);
        d.setDocumentNo("OKC-" + c.getCheckNo() + "-" + no);
        d.setOkcZNo(z);
        d.setTotal(nz(c.getTotalAmount()));
        d.setVatTotal(nz(c.getVatAmount()));
        d.setCreatedAt(LocalDateTime.now());
        d.setCreatedBy(currentUserService.require().displayName());
        d.setProvider("OKC");
        d.setProviderRef(no);
        FiscalDocument saved = documentRepository.save(d);
        auditService.log("FISCAL_OKC_RECORDED", "CHECK", c.getId(), null, FiscalDocument.RECORDED,
                c.getCheckNo() + " | OKC fis " + no + (z != null ? " | Z " + z : ""));
        return saved;
    }

    // ── Sorgular ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FiscalDocument> forCheck(Long checkId) {
        return documentRepository.findByCheckIdOrderByCreatedAtAsc(checkId);
    }

    @Transactional(readOnly = true)
    public FiscalDocument get(Long id) {
        return documentRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Belge bulunamadi: " + id));
    }

    /** Gunun mali belge ozeti: belgeli / belgesiz adisyonlar (muhasebe ve musavir mutabakati) */
    @Transactional(readOnly = true)
    public Map<String, Object> daySummary(LocalDate day) {
        LocalDateTime from = day.atStartOfDay(), to = day.plusDays(1).atStartOfDay();
        List<TableCheck> paid = checkRepository.findByStatusAndClosedAtBetween(TableCheck.PAID, from, to);
        Set<Long> ids = paid.stream().map(TableCheck::getId).collect(Collectors.toSet());
        List<FiscalDocument> docs = ids.isEmpty() ? List.of() : documentRepository.findByCheckIdInAndStatusNot(ids, FiscalDocument.CANCELLED);
        Set<Long> covered = docs.stream().map(FiscalDocument::getCheckId).collect(Collectors.toSet());
        List<Map<String, Object>> missing = new ArrayList<>();
        BigDecimal missingTotal = BigDecimal.ZERO;
        for (TableCheck c : paid) {
            if (covered.contains(c.getId())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("checkId", c.getId());
            m.put("checkNo", c.getCheckNo());
            m.put("tableNumber", c.getTableNumber());
            m.put("total", c.getTotalAmount());
            m.put("closedAt", c.getClosedAt());
            m.put("closedBy", c.getClosedBy());
            missing.add(m);
            missingTotal = missingTotal.add(nz(c.getTotalAmount()));
        }
        Map<String, Long> byType = docs.stream().collect(Collectors.groupingBy(FiscalDocument::getType, TreeMap::new, Collectors.counting()));
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("date", day);
        r.put("paidChecks", paid.size());
        r.put("documentedChecks", covered.size());
        r.put("documentsByType", byType);
        r.put("missingCount", missing.size());
        r.put("missingTotal", missingTotal);
        r.put("missing", missing);
        r.put("provider", provider);
        return r;
    }

    // ── Yardimcilar ────────────────────────────────────────────

    private TableCheck paidCheck(Long checkId) {
        TableCheck c = checkRepository.findById(checkId).orElseThrow(() -> new ResourceNotFoundException("Adisyon bulunamadi: " + checkId));
        if (!TableCheck.PAID.equals(c.getStatus())) throw new BusinessRuleException("Mali belge yalnizca odemesi tamamlanmis adisyon icin duzenlenir");
        return c;
    }

    private String nextDocumentNo(int year) {
        String head = prefix + year;
        String max = documentRepository.maxDocumentNo(head);
        long next = 1;
        if (max != null && max.length() == 16) {
            try { next = Long.parseLong(max.substring(7)) + 1; } catch (NumberFormatException ignored) { /* bozuk numara */ }
        }
        return head + String.format("%09d", next);
    }

    /** UBL-TR 1.2 e-Arsiv fatura (imza ve XSLT entegrator tarafindan eklenir). */
    String ublInvoice(FiscalDocument d, List<SalesRecord> lines) {
        Map<BigDecimal, BigDecimal[]> byRate = new TreeMap<>();
        StringBuilder lineXml = new StringBuilder();
        BigDecimal net = BigDecimal.ZERO;
        int i = 0;
        for (SalesRecord s : lines) {
            i++;
            BigDecimal gross = nz(s.getTotalPrice()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal vat = s.getVatAmount().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineNet = gross.subtract(vat);
            BigDecimal rate = s.getVatRate().setScale(0, RoundingMode.HALF_UP);
            int qty = s.getQuantity() == null || s.getQuantity() < 1 ? 1 : s.getQuantity();
            BigDecimal unitNet = lineNet.divide(BigDecimal.valueOf(qty), 4, RoundingMode.HALF_UP);
            net = net.add(lineNet);
            byRate.computeIfAbsent(rate, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            byRate.get(rate)[0] = byRate.get(rate)[0].add(lineNet);
            byRate.get(rate)[1] = byRate.get(rate)[1].add(vat);
            lineXml.append("  <cac:InvoiceLine>\n")
                    .append("    <cbc:ID>").append(i).append("</cbc:ID>\n")
                    .append("    <cbc:InvoicedQuantity unitCode=\"C62\">").append(qty).append("</cbc:InvoicedQuantity>\n")
                    .append("    <cbc:LineExtensionAmount currencyID=\"TRY\">").append(lineNet.toPlainString()).append("</cbc:LineExtensionAmount>\n")
                    .append("    <cac:TaxTotal>\n")
                    .append("      <cbc:TaxAmount currencyID=\"TRY\">").append(vat.toPlainString()).append("</cbc:TaxAmount>\n")
                    .append("      <cac:TaxSubtotal>\n")
                    .append("        <cbc:TaxableAmount currencyID=\"TRY\">").append(lineNet.toPlainString()).append("</cbc:TaxableAmount>\n")
                    .append("        <cbc:TaxAmount currencyID=\"TRY\">").append(vat.toPlainString()).append("</cbc:TaxAmount>\n")
                    .append("        <cbc:Percent>").append(rate.toPlainString()).append("</cbc:Percent>\n")
                    .append("        <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>\n")
                    .append("      </cac:TaxSubtotal>\n")
                    .append("    </cac:TaxTotal>\n")
                    .append("    <cac:Item><cbc:Name>").append(esc(s.getProductName())).append("</cbc:Name></cac:Item>\n")
                    .append("    <cac:Price><cbc:PriceAmount currencyID=\"TRY\">").append(unitNet.toPlainString()).append("</cbc:PriceAmount></cac:Price>\n")
                    .append("  </cac:InvoiceLine>\n");
        }
        BigDecimal vatTotal = d.getVatTotal();
        StringBuilder taxXml = new StringBuilder();
        taxXml.append("  <cac:TaxTotal>\n    <cbc:TaxAmount currencyID=\"TRY\">").append(vatTotal.toPlainString()).append("</cbc:TaxAmount>\n");
        byRate.forEach((rate, v) -> taxXml
                .append("    <cac:TaxSubtotal>\n")
                .append("      <cbc:TaxableAmount currencyID=\"TRY\">").append(v[0].setScale(2, RoundingMode.HALF_UP).toPlainString()).append("</cbc:TaxableAmount>\n")
                .append("      <cbc:TaxAmount currencyID=\"TRY\">").append(v[1].setScale(2, RoundingMode.HALF_UP).toPlainString()).append("</cbc:TaxAmount>\n")
                .append("      <cbc:Percent>").append(rate.toPlainString()).append("</cbc:Percent>\n")
                .append("      <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>\n")
                .append("    </cac:TaxSubtotal>\n"));
        taxXml.append("  </cac:TaxTotal>\n");
        String netStr = net.setScale(2, RoundingMode.HALF_UP).toPlainString();
        String totalStr = d.getTotal().toPlainString();
        boolean isVkn = d.getBuyerTaxId() != null && d.getBuyerTaxId().length() == 10;
        String[] buyerNames = d.getBuyerName().split("\\s+", 2);
        String customerParty = isVkn
                ? "      <cac:PartyIdentification><cbc:ID schemeID=\"VKN\">" + d.getBuyerTaxId() + "</cbc:ID></cac:PartyIdentification>\n"
                + "      <cac:PartyName><cbc:Name>" + esc(d.getBuyerName()) + "</cbc:Name></cac:PartyName>\n"
                + "      <cac:PostalAddress><cbc:CityName>-</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>\n"
                + "      <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>" + esc(d.getBuyerTaxOffice()) + "</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>\n"
                : "      <cac:PartyIdentification><cbc:ID schemeID=\"TCKN\">" + d.getBuyerTaxId() + "</cbc:ID></cac:PartyIdentification>\n"
                + "      <cac:PostalAddress><cbc:CityName>-</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>\n"
                + "      <cac:Person><cbc:FirstName>" + esc(buyerNames[0]) + "</cbc:FirstName><cbc:FamilyName>"
                + esc(buyerNames.length > 1 ? buyerNames[1] : "-") + "</cbc:FamilyName></cac:Person>\n";
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"\n"
                + "         xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"\n"
                + "         xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">\n"
                + "  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>\n"
                + "  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>\n"
                + "  <cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>\n"
                + "  <cbc:ID>" + d.getDocumentNo() + "</cbc:ID>\n"
                + "  <cbc:CopyIndicator>false</cbc:CopyIndicator>\n"
                + "  <cbc:UUID>" + d.getUuid() + "</cbc:UUID>\n"
                + "  <cbc:IssueDate>" + d.getCreatedAt().format(DATE) + "</cbc:IssueDate>\n"
                + "  <cbc:IssueTime>" + d.getCreatedAt().format(TIME) + "</cbc:IssueTime>\n"
                + "  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>\n"
                + "  <cbc:Note>Adisyon " + esc(d.getCheckNo()) + "</cbc:Note>\n"
                + "  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>\n"
                + "  <cbc:LineCountNumeric>" + lines.size() + "</cbc:LineCountNumeric>\n"
                + "  <cac:AdditionalDocumentReference><cbc:ID>ELEKTRONIK</cbc:ID><cbc:IssueDate>" + d.getCreatedAt().format(DATE)
                + "</cbc:IssueDate><cbc:DocumentTypeCode>SEND_TYPE</cbc:DocumentTypeCode></cac:AdditionalDocumentReference>\n"
                + "  <cac:AccountingSupplierParty>\n    <cac:Party>\n"
                + "      <cac:PartyIdentification><cbc:ID schemeID=\"VKN\">" + esc(companyVkn) + "</cbc:ID></cac:PartyIdentification>\n"
                + "      <cac:PartyName><cbc:Name>" + esc(companyTitle) + "</cbc:Name></cac:PartyName>\n"
                + "      <cac:PostalAddress><cbc:StreetName>" + esc(companyAddress) + "</cbc:StreetName><cbc:CityName>" + esc(companyCity)
                + "</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>\n"
                + "      <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>" + esc(companyTaxOffice) + "</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>\n"
                + "    </cac:Party>\n  </cac:AccountingSupplierParty>\n"
                + "  <cac:AccountingCustomerParty>\n    <cac:Party>\n" + customerParty
                + (d.getBuyerEmail() != null ? "      <cac:Contact><cbc:ElectronicMail>" + esc(d.getBuyerEmail()) + "</cbc:ElectronicMail></cac:Contact>\n" : "")
                + "    </cac:Party>\n  </cac:AccountingCustomerParty>\n"
                + taxXml
                + "  <cac:LegalMonetaryTotal>\n"
                + "    <cbc:LineExtensionAmount currencyID=\"TRY\">" + netStr + "</cbc:LineExtensionAmount>\n"
                + "    <cbc:TaxExclusiveAmount currencyID=\"TRY\">" + netStr + "</cbc:TaxExclusiveAmount>\n"
                + "    <cbc:TaxInclusiveAmount currencyID=\"TRY\">" + totalStr + "</cbc:TaxInclusiveAmount>\n"
                + "    <cbc:PayableAmount currencyID=\"TRY\">" + totalStr + "</cbc:PayableAmount>\n"
                + "  </cac:LegalMonetaryTotal>\n"
                + lineXml
                + "</Invoice>\n";
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
