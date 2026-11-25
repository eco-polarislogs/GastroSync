package com.gastrosync.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.model.PrintJob;
import com.gastrosync.model.Printer;
import com.gastrosync.service.PosService;
import com.gastrosync.service.print.PrintService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/print")
@Tag(name = "Yazdirma", description = "Fis yazicilari, yazdirma isleri ve yazici koprusu")
public class PrintController {

    private final PrintService printService;
    private final PosService posService;

    public PrintController(PrintService printService, PosService posService) {
        this.printService = printService;
        this.posService = posService;
    }

    @GetMapping("/printers")
    @PreAuthorize("@perm.can('POS_VIEW')")
    public ResponseEntity<ApiResponse<List<Printer>>> printers() {
        return ResponseEntity.ok(ApiResponse.ok("Yazicilar", printService.printers()));
    }

    @PostMapping("/printers")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    public ResponseEntity<ApiResponse<Printer>> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Yazici eklendi", printService.save(null, body)));
    }

    @PutMapping("/printers/{id}")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    public ResponseEntity<ApiResponse<Printer>> update(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.ok("Yazici guncellendi", printService.save(id, body)));
    }

    @DeleteMapping("/printers/{id}")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delete(@PathVariable("id") Long id) {
        printService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Yazici silindi", Map.of("id", id)));
    }

    @PostMapping("/printers/{id}/test")
    @PreAuthorize("@perm.can('POS_TABLE_MANAGE')")
    public ResponseEntity<ApiResponse<PrintJob>> test(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Test baskisi gonderildi", printService.testPrint(id)));
    }

    @PostMapping("/checks/{id}")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    @Operation(summary = "Adisyon dokumu (type=BILL) veya bilgi fisi (type=RECEIPT) kasa yazicisina")
    public ResponseEntity<ApiResponse<List<PrintJob>>> printCheck(@PathVariable("id") Long id,
                                                                  @RequestParam(name = "type", defaultValue = "BILL") String type) {
        String t = "RECEIPT".equalsIgnoreCase(type) ? "RECEIPT" : "BILL";
        return ResponseEntity.ok(ApiResponse.ok("Yazdirma isi olusturuldu", printService.printCheck(posService.checkDetail(id), t)));
    }

    @GetMapping("/jobs")
    @PreAuthorize("@perm.can('POS_VIEW')")
    public ResponseEntity<ApiResponse<List<PrintJob>>> jobs() {
        return ResponseEntity.ok(ApiResponse.ok("Son yazdirma isleri", printService.recentJobs()));
    }

    @PostMapping("/jobs/{id}/retry")
    @PreAuthorize("@perm.can('POS_OPERATE')")
    public ResponseEntity<ApiResponse<PrintJob>> retry(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Yeniden denenecek", printService.retry(id)));
    }

    /** Yazici koprusu cihazi: bekleyen BRIDGE islerini alir */
    @GetMapping("/bridge/jobs")
    @PreAuthorize("@perm.can('POS_VIEW')")
    public ResponseEntity<ApiResponse<List<PrintJob>>> bridgeJobs() {
        return ResponseEntity.ok(ApiResponse.ok("Bekleyen isler", printService.pendingBridgeJobs()));
    }

    @PutMapping("/bridge/jobs/{id}")
    @PreAuthorize("@perm.can('POS_VIEW')")
    public ResponseEntity<ApiResponse<PrintJob>> bridgeResult(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        boolean ok = Boolean.parseBoolean(String.valueOf(body.get("ok")));
        Object err = body.get("error");
        return ResponseEntity.ok(ApiResponse.ok("Sonuc kaydedildi", printService.reportBridgeResult(id, ok, err == null ? null : String.valueOf(err))));
    }
}
