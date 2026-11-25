package com.gastrosync.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gastrosync.dto.ApiResponse;
import com.gastrosync.dto.auth.AuthResponse;
import com.gastrosync.dto.auth.LoginRequest;
import com.gastrosync.dto.user.UserCreateRequest;
import com.gastrosync.dto.user.UserResponse;
import com.gastrosync.security.CurrentUserService;
import com.gastrosync.service.DemoAccountService;
import com.gastrosync.service.UserService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Kimlik Dogrulama")
public class AuthController {

    private final UserService userService;
    private final CurrentUserService currentUserService;
    private final DemoAccountService demoAccountService;

    public AuthController(UserService userService, CurrentUserService currentUserService,
                          DemoAccountService demoAccountService) {
        this.userService = userService;
        this.currentUserService = currentUserService;
        this.demoAccountService = demoAccountService;
    }

    /** Demo / tanitim modunda hizli giris hesaplari. Canli ortamda (demo kapali) bos liste doner. */
    @GetMapping("/demo-accounts")
    public ResponseEntity<ApiResponse<Map<String, Object>>> demoAccounts() {
        return ResponseEntity.ok(ApiResponse.ok("Demo hesaplari", Map.of(
                "enabled", demoAccountService.isDemoMode(),
                "accounts", demoAccountService.list())));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Giris basarili", userService.authenticate(request)));
    }

    @PostMapping("/register")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Kullanici kaydi tamamlandi", userService.createUser(request)));
    }

    /** Rol katalogu: her rolun gorev tanimi, ekranlari ve izinleri (personel kaydi ekrani icin) */
    @GetMapping("/roles")
    @PreAuthorize("@perm.can('USER_MANAGE')")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> roles() {
        return ResponseEntity.ok(ApiResponse.ok("Roller", com.gastrosync.security.Permissions.catalog()));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser() {
        return ResponseEntity.ok(ApiResponse.ok("Kullanici profili",
                userService.getUserByUsername(currentUserService.require().username())));
    }

    /** Erisim token'ini yeniler (yenileme token'i dondurulur). Kimlik dogrulama gerektirmez. */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Oturum yenilendi", userService.refresh(body == null ? null : body.get("refreshToken"))));
    }

    /** Bu cihazdan cikis: yenileme token'i iptal edilir. Gecersiz token da 200 doner (bilgi sizdirmaz). */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody(required = false) Map<String, String> body) {
        userService.logout(body == null ? null : body.get("refreshToken"));
        return ResponseEntity.ok(ApiResponse.ok("Cikis yapildi", null));
    }

    /** Tum cihazlardan cikis (kayip / calinti cihaz) */
    @PostMapping("/logout-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> logoutAll() {
        userService.revokeMySessions();
        return ResponseEntity.ok(ApiResponse.ok("Tum cihazlardaki oturumlariniz sonlandirildi", null));
    }

    @GetMapping("/sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> sessions() {
        return ResponseEntity.ok(ApiResponse.ok("Acik oturumlar", userService.mySessions()));
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AuthResponse>> changePassword(@RequestBody Map<String, String> body) {
        AuthResponse response = userService.changeOwnPassword(body.get("currentPassword"), body.get("newPassword"));
        return ResponseEntity.ok(ApiResponse.ok("Sifreniz guncellendi. Diger cihazlardaki oturumlar kapatildi.", response));
    }
}
