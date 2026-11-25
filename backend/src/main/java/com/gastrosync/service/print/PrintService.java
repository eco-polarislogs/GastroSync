package com.gastrosync.service.print;

import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.gastrosync.exception.BusinessRuleException;
import com.gastrosync.exception.ResourceNotFoundException;
import com.gastrosync.model.PrintJob;
import com.gastrosync.model.Printer;
import com.gastrosync.repository.PrintJobRepository;
import com.gastrosync.repository.PrinterRepository;
import com.gastrosync.security.AppRoles;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.service.AuditService;
import com.gastrosync.service.NotificationService;

/**
 * Yazdirma: mutfak / bar siparis fisi, adisyon dokumu, bilgi fisi.
 * DIRECT yazicilara sunucu arka planda ham TCP ile gonderir; BRIDGE yazicilarin isleri kuyrukta bekler ve
 * restorandaki yazici koprusu cihazi tarafindan alinip yerel agdaki yaziciya iletilir.
 * Yazdirma hatasi satisi / siparisi asla engellemez; kasiyer ve mudur bilgilendirilir, is yeniden denenebilir.
 */
@Service
public class PrintService {

    private static final Logger log = LoggerFactory.getLogger(PrintService.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final PrinterRepository printerRepository;
    private final PrintJobRepository jobRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final String restaurantName;
    private final String restaurantFooter;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "gastrosync-print");
        t.setDaemon(true);
        return t;
    });

    public PrintService(PrinterRepository printerRepository, PrintJobRepository jobRepository,
                        NotificationService notificationService, AuditService auditService,
                        CurrentUserService currentUserService,
                        @Value("${gastrosync.restaurant.name:GastroSync Restoran}") String restaurantName,
                        @Value("${gastrosync.restaurant.receipt-footer:Afiyet olsun!}") String restaurantFooter) {
        this.printerRepository = printerRepository;
        this.jobRepository = jobRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.restaurantName = restaurantName;
        this.restaurantFooter = restaurantFooter;
    }

    // ── Yazici tanimlari ───────────────────────────────────────

    public List<Printer> printers() {
        return printerRepository.findAllByOrderByStationAscNameAsc();
    }

    public Printer save(Long id, Map<String, Object> body) {
        Printer p = id == null ? new Printer() : printerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Yazici bulunamadi: " + id));
        String name = str(body.get("name"));
        if (name == null || name.length() > 60) throw new IllegalArgumentException("Yazici adi zorunlu (en fazla 60 karakter)");
        String station = upper(body.get("station"), Printer.KITCHEN);
        if (!List.of(Printer.KITCHEN, Printer.BAR, Printer.RECEIPT).contains(station)) {
            throw new IllegalArgumentException("Istasyon KITCHEN, BAR veya RECEIPT olmalidir");
        }
        String host = str(body.get("host"));
        if (host == null || !host.matches("^[A-Za-z0-9.\\-]{1,120}$")) throw new IllegalArgumentException("Yazici IP / ana makine adi gecersiz");
        int port = body.get("port") == null || str(body.get("port")) == null ? 9100 : Integer.parseInt(str(body.get("port")));
        if (port < 1 || port > 65535) throw new IllegalArgumentException("Port 1-65535 arasinda olmalidir");
        String conn = upper(body.get("connection"), Printer.DIRECT);
        if (!List.of(Printer.DIRECT, Printer.BRIDGE).contains(conn)) throw new IllegalArgumentException("Baglanti DIRECT veya BRIDGE olmalidir");
        int cpl = body.get("charsPerLine") == null || str(body.get("charsPerLine")) == null ? 48 : Integer.parseInt(str(body.get("charsPerLine")));
        if (cpl != 32 && cpl != 42 && cpl != 48) throw new IllegalArgumentException("Satir genisligi 32 (58 mm), 42 veya 48 (80 mm) olmalidir");
        p.setName(name);
        p.setStation(station);
        p.setHost(host);
        p.setPort(port);
        p.setConnection(conn);
        p.setCharsPerLine(cpl);
        p.setActive(body.get("active") == null || Boolean.parseBoolean(String.valueOf(body.get("active"))));
        Printer saved = printerRepository.save(p);
        auditService.log(id == null ? "PRINTER_CREATED" : "PRINTER_UPDATED", "PRINTER", saved.getId(), null, null,
                saved.getName() + " | " + saved.getStation() + " | " + saved.getHost() + ":" + saved.getPort() + " | " + saved.getConnection());
        return saved;
    }

    public void delete(Long id) {
        Printer p = printerRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Yazici bulunamadi: " + id));
        printerRepository.delete(p);
        auditService.log("PRINTER_DELETED", "PRINTER", id, null, null, p.getName());
    }

    public PrintJob testPrint(Long printerId) {
        Printer p = printerRepository.findById(printerId).orElseThrow(() -> new ResourceNotFoundException("Yazici bulunamadi: " + printerId));
        EscPos e = new EscPos(p.getCharsPerLine());
        e.center().bold(true).big(true).line("TEST").big(false).bold(false)
                .line(restaurantName).line(p.getName() + " · " + stationLabel(p.getStation()))
                .line(LocalDateTime.now().format(TS)).left().rule()
                .line("Turkce karakter: ı İ ş Ş ğ Ğ ü Ü ö Ö ç Ç").pair("Sol", "Sag").rule().cut();
        return enqueue(p, "TEST", "Test baskisi", e.bytes());
    }

    // ── Is olusturma ───────────────────────────────────────────

    /** Siparis girildiginde mutfak / bar fisleri (aktif istasyon yazicisi yoksa hicbir sey yapmaz). */
    public void kitchenTickets(String checkNo, Integer tableNumber, String waiter, List<TicketLine> lines) {
        if (lines == null || lines.isEmpty()) return;
        try {
            Map<String, List<TicketLine>> byStation = new LinkedHashMap<>();
            for (TicketLine l : lines) byStation.computeIfAbsent(l.beverage() ? Printer.BAR : Printer.KITCHEN, k -> new ArrayList<>()).add(l);
            byStation.forEach((station, list) -> {
                List<Printer> targets = printerRepository.findByStationAndActiveTrue(station);
                // Bar yazicisi yoksa icecekler mutfak yazicisina duser
                if (targets.isEmpty() && Printer.BAR.equals(station)) targets = printerRepository.findByStationAndActiveTrue(Printer.KITCHEN);
                for (Printer p : targets) {
                    EscPos e = new EscPos(p.getCharsPerLine());
                    e.center().bold(true).big(true).line(stationLabel(station).toUpperCase(Locale.forLanguageTag("tr")))
                            .line("MASA " + tableNumber).big(false).bold(false)
                            .line(checkNo + " · " + LocalDateTime.now().format(TS))
                            .line("Garson/Kasiyer: " + (waiter == null ? "-" : waiter)).left().rule();
                    for (TicketLine l : list) {
                        e.bold(true).big(true).wrap(l.quantity() + " x " + l.name(), null).big(false).bold(false);
                        if (l.note() != null && !l.note().isBlank()) e.wrap("NOT: " + l.note(), "   ");
                    }
                    e.rule().cut();
                    enqueue(p, "KITCHEN_TICKET", "Masa " + tableNumber + " · " + stationLabel(station), e.bytes());
                }
            });
        } catch (RuntimeException ex) {
            log.warn("Mutfak fisi olusturulamadi: {}", ex.getMessage());
        }
    }

    /**
     * Adisyon dokumu (BILL, odeme oncesi) veya bilgi fisi (RECEIPT, odeme sonrasi).
     * check: PosService.checkDetail ciktisi.
     */
    @SuppressWarnings("unchecked")
    public List<PrintJob> printCheck(Map<String, Object> check, String type) {
        List<Printer> targets = printerRepository.findByStationAndActiveTrue(Printer.RECEIPT);
        if (targets.isEmpty()) throw new BusinessRuleException("Aktif kasa (RECEIPT) yazicisi tanimli degil. Ayarlar > Yazicilar'dan ekleyin "
                + "veya tarayicidan yazdirin.");
        boolean receipt = "RECEIPT".equals(type);
        List<PrintJob> jobs = new ArrayList<>();
        for (Printer p : targets) {
            EscPos e = new EscPos(p.getCharsPerLine());
            e.center().bold(true).big(true).line(restaurantName).big(false).bold(false)
                    .line(receipt ? "BILGI FISI" : "ADISYON DOKUMU")
                    .line("Masa " + check.get("tableNumber") + " · " + check.get("checkNo"))
                    .line(LocalDateTime.now().format(TS)).left().rule();
            List<Object> items = (List<Object>) check.getOrDefault("items", List.of());
            for (Object o : items) {
                Map<String, Object> it = asMap(o);
                if (it == null) continue;
                String status = String.valueOf(it.get("status"));
                if ("CANCELLED".equals(status)) continue;
                boolean comp = Boolean.TRUE.equals(it.get("comp"));
                String name = it.get("quantity") + " x " + it.get("productName");
                e.pair(name, comp ? "IKRAM" : money(it.get("lineTotal")));
            }
            e.rule();
            BigDecimal discount = dec(check.get("discountAmount"));
            if (discount.signum() > 0) e.pair("Ara toplam", money(check.get("subtotal"))).pair("Indirim", "-" + money(discount));
            e.bold(true).big(true).pair("TOPLAM", money(check.get("total"))).big(false).bold(false);
            if (check.get("vatAmount") != null) e.pair("KDV dahil (KDV)", money(check.get("vatAmount")));
            List<Object> pays = (List<Object>) check.getOrDefault("payments", List.of());
            if (!pays.isEmpty()) {
                e.rule();
                for (Object o : pays) {
                    Map<String, Object> pm = asMap(o);
                    if (pm == null || Boolean.TRUE.equals(pm.get("voided"))) continue;
                    e.pair(methodLabel(String.valueOf(pm.get("method"))) + (pm.get("label") != null ? " (" + pm.get("label") + ")" : ""), money(pm.get("amount")));
                    if (pm.get("changeAmount") != null && dec(pm.get("changeAmount")).signum() > 0) e.pair("  Para ustu", money(pm.get("changeAmount")));
                }
                BigDecimal remaining = dec(check.get("remainingAmount"));
                if (remaining.signum() > 0) e.bold(true).pair("KALAN", money(remaining)).bold(false);
            }
            e.rule().center();
            if (receipt) e.wrap("Bu belge bilgi amaclidir; mali belge yerine gecmez. Mali belgeniz ayrica verilir.", null);
            e.line(restaurantFooter).left().cut();
            jobs.add(enqueue(p, receipt ? "RECEIPT" : "BILL", "Masa " + check.get("tableNumber") + " · " + (receipt ? "Fis" : "Adisyon"), e.bytes()));
        }
        return jobs;
    }

    private PrintJob enqueue(Printer p, String type, String title, byte[] bytes) {
        PrintJob j = new PrintJob();
        j.setPrinterId(p.getId());
        j.setPrinterName(p.getName());
        j.setConnection(p.getConnection());
        j.setHost(p.getHost());
        j.setPort(p.getPort());
        j.setType(type);
        j.setTitle(title);
        j.setPayload(Base64.getEncoder().encodeToString(bytes));
        j.setCreatedAt(LocalDateTime.now());
        j.setCreatedBy(safeUser());
        PrintJob saved = jobRepository.save(j);
        if (Printer.DIRECT.equals(p.getConnection())) {
            Long id = saved.getId();
            executor.submit(() -> sendDirect(id));
        } else {
            notificationService.publish("/topic/print", Map.of("type", "JOB", "id", saved.getId()));
        }
        return saved;
    }

    private void sendDirect(Long jobId) {
        PrintJob j = jobRepository.findById(jobId).orElse(null);
        if (j == null) return;
        j.setAttempts(j.getAttempts() + 1);
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(j.getHost(), j.getPort()), 3000);
            s.setSoTimeout(5000);
            OutputStream os = s.getOutputStream();
            os.write(Base64.getDecoder().decode(j.getPayload()));
            os.flush();
            j.setStatus(PrintJob.PRINTED);
            j.setPrintedAt(LocalDateTime.now());
            j.setPrintedBy("sunucu");
            j.setError(null);
        } catch (Exception ex) {
            j.setStatus(PrintJob.FAILED);
            j.setError(trim(ex.getClass().getSimpleName() + ": " + ex.getMessage()));
            notifyFailure(j);
        }
        jobRepository.save(j);
    }

    // ── Kuyruk (yazici koprusu) ────────────────────────────────

    public List<PrintJob> pendingBridgeJobs() {
        return jobRepository.findTop20ByConnectionAndStatusOrderByCreatedAtAsc(Printer.BRIDGE, PrintJob.PENDING);
    }

    public PrintJob reportBridgeResult(Long jobId, boolean ok, String error) {
        PrintJob j = jobRepository.findById(jobId).orElseThrow(() -> new ResourceNotFoundException("Yazdirma isi bulunamadi: " + jobId));
        j.setAttempts(j.getAttempts() + 1);
        if (ok) {
            j.setStatus(PrintJob.PRINTED);
            j.setPrintedAt(LocalDateTime.now());
            j.setPrintedBy(safeUser());
            j.setError(null);
        } else {
            j.setStatus(PrintJob.FAILED);
            j.setError(trim(error));
            notifyFailure(j);
        }
        return jobRepository.save(j);
    }

    public List<PrintJob> recentJobs() {
        return jobRepository.findTop50ByOrderByCreatedAtDesc();
    }

    public PrintJob retry(Long jobId) {
        PrintJob j = jobRepository.findById(jobId).orElseThrow(() -> new ResourceNotFoundException("Yazdirma isi bulunamadi: " + jobId));
        j.setStatus(PrintJob.PENDING);
        j.setError(null);
        PrintJob saved = jobRepository.save(j);
        if (Printer.DIRECT.equals(j.getConnection())) executor.submit(() -> sendDirect(jobId));
        else notificationService.publish("/topic/print", Map.of("type", "JOB", "id", jobId));
        return saved;
    }

    private void notifyFailure(PrintJob j) {
        try {
            notificationService.notify(List.of(AppRoles.CASHIER, AppRoles.MANAGER),
                    "Yaziciya Ulasilamadi: " + j.getPrinterName(),
                    String.format("'%s' baskisi %s (%s:%d) yazicisina gonderilemedi: %s. Yazici acik ve agda mi? Ayarlar > Yazicilar'dan yeniden deneyin.",
                            j.getTitle(), j.getPrinterName(), j.getHost(), j.getPort(), j.getError()),
                    "Sistem", "PRINT_FAILED", j.getId(), "/pos", "WARNING");
        } catch (RuntimeException e) {
            log.warn("Yazdirma hatasi bildirilemedi: {}", e.getMessage());
        }
    }

    // ── Yardimcilar ────────────────────────────────────────────

    public record TicketLine(String name, int quantity, String note, boolean beverage) {}

    private String safeUser() {
        try { return currentUserService.require().displayName(); } catch (RuntimeException e) { return "Sistem"; }
    }

    private static String stationLabel(String s) {
        return switch (s) { case Printer.BAR -> "Bar"; case Printer.RECEIPT -> "Kasa"; default -> "Mutfak"; };
    }

    private static String methodLabel(String m) {
        return switch (m) { case "CASH" -> "Nakit"; case "MEAL_CARD" -> "Yemek karti"; case "CREDIT_CARD" -> "Kredi karti"; default -> m; };
    }

    private static String money(Object v) {
        DecimalFormat f = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("tr")));
        return f.format(dec(v).setScale(2, RoundingMode.HALF_UP)) + " TL";
    }

    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal b) return b;
        try { return new BigDecimal(String.valueOf(v)); } catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        if (o instanceof Map<?, ?> m) return (Map<String, Object>) m;
        if (o instanceof com.gastrosync.model.CheckItem ci) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("productName", ci.getProductName());
            m.put("quantity", ci.getQuantity());
            m.put("lineTotal", ci.getLineTotal());
            m.put("status", ci.getStatus());
            m.put("comp", ci.isComp());
            return m;
        }
        return null;
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    private static String upper(Object o, String def) {
        String s = str(o);
        return s == null ? def : s.toUpperCase(Locale.ROOT);
    }

    private static String trim(String s) {
        if (s == null) return null;
        return s.length() > 290 ? s.substring(0, 290) : s;
    }
}
