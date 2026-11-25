package com.gastrosync.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.auth.AuthResponse;
import com.gastrosync.dto.auth.LoginRequest;
import com.gastrosync.dto.user.UserCreateRequest;
import com.gastrosync.dto.user.UserResponse;
import com.gastrosync.service.UserService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Kullanici Yonetimi")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok("Kullanicilar", userService.getAllUsers()));
    }

    @GetMapping("/search")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<com.gastrosync.dto.PageResponse<UserResponse>>> search(
            @org.springframework.web.bind.annotation.RequestParam(name = "q", required = false) String q,
            @org.springframework.web.bind.annotation.RequestParam(name = "role", required = false) String role,
            @org.springframework.web.bind.annotation.RequestParam(name = "status", required = false) String status,
            @org.springframework.web.bind.annotation.RequestParam(name = "sort", required = false) String sort,
            @org.springframework.web.bind.annotation.RequestParam(name = "page", required = false) Integer page,
            @org.springframework.web.bind.annotation.RequestParam(name = "size", required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.ok("Personel", userService.search(q, role, status, sort, page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserById(id)));
    }

    @PostMapping
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Personel hesabi olusturuldu; verilen kullanici adi ve sifreyle rolunun ekranina girebilir.",
                        userService.createUser(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(@PathVariable("id") Long id,
                                                                   @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(ApiResponse.ok("Kullanici bilgileri guncellendi",
                userService.updateProfile(id, payload.get("name"), payload.get("email"))));
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(@PathVariable("id") Long id,
                                                                @RequestBody Map<String, String> payload) {
        String newRole = payload.get("role");
        if (newRole == null || newRole.isBlank()) {
            throw new IllegalArgumentException("Yeni rol belirtilmelidir");
        }
        return ResponseEntity.ok(ApiResponse.ok("Kullanici rolu guncellendi", userService.updateUserRole(id, newRole)));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> setStatus(@PathVariable("id") Long id,
                                                               @RequestBody Map<String, Object> payload) {
        Object active = payload.get("active");
        if (active == null) {
            throw new IllegalArgumentException("'active' alani zorunludur");
        }
        boolean value = Boolean.parseBoolean(active.toString());
        return ResponseEntity.ok(ApiResponse.ok(value ? "Hesap aktiflestirildi" : "Hesap pasife alindi",
                userService.setActive(id, value)));
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> resetPassword(@PathVariable("id") Long id,
                                                                   @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(ApiResponse.ok("Gecici sifre belirlendi; kullanici ilk giriste degistirecek",
                userService.resetPassword(id, payload.get("temporaryPassword"))));
    }

    /** KVKK / Google Play: kullanici kendi hesabinin silinmesini talep eder (Yoneticiye bildirim + denetim izi) */
    @PostMapping("/me/deletion-request")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> requestDeletion(@RequestBody(required = false) Map<String, String> payload) {
        userService.requestOwnDeletion(payload == null ? null : payload.get("reason"));
        return ResponseEntity.ok(ApiResponse.ok("Hesap silme talebiniz yoneticiye iletildi", null));
    }

    /** Personelin tum cihazlardaki oturumlarini sonlandirir (kayip telefon, isten ayrilma) */
    @PostMapping("/{id}/revoke-sessions")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> revokeSessions(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Kullanicinin tum oturumlari sonlandirildi", userService.revokeSessions(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteUser(@PathVariable("id") Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.ok("Kullanici arsivlendi", Map.of("id", id)));
    }

    /** Eski istemciler icin geriye donuk uyumlu giris ucu */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> legacyLogin(@Valid @RequestBody LoginRequest credentials) {
        return ResponseEntity.ok(ApiResponse.ok("Giris basarili", userService.authenticate(credentials)));
    }
}
