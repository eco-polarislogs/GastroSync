package com.gastrosync.controller;

import com.gastrosync.model.AppUser;
import com.gastrosync.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository repository;

    public UserController(AppUserRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<AppUser> getAll() {
        return repository.findAll();
    }

    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody Map<String, String> credentials) {
        String identifier = credentials.get("username");
        String password = credentials.get("password");

        if (identifier == null || password == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Kullanıcı adı/e-posta ve şifre zorunludur"));
        }

        String cleanId = identifier.trim();
        Optional<AppUser> userOpt = repository.findByUsernameIgnoreCase(cleanId);
        if (userOpt.isEmpty()) {
            userOpt = repository.findByEmailIgnoreCase(cleanId);
        }

        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password.trim())) {
            return ResponseEntity.ok(userOpt.get());
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Geçersiz kullanıcı adı/e-posta veya şifre"));
    }

    @PostMapping
    public ResponseEntity<Object> createUser(@RequestBody AppUser newUser) {
        if (newUser.getUsername() == null || newUser.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Kullanıcı adı zorunludur"));
        }
        if (repository.findByUsername(newUser.getUsername().trim().toLowerCase()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Bu kullanıcı adı zaten kullanımda"));
        }

        newUser.setUsername(newUser.getUsername().trim().toLowerCase());
        if (newUser.getPassword() == null || newUser.getPassword().trim().isEmpty()) {
            newUser.setPassword("123456");
        }
        if (newUser.getRole() == null || newUser.getRole().trim().isEmpty()) {
            newUser.setRole("MANAGER");
        } else {
            newUser.setRole(newUser.getRole().toUpperCase());
        }

        AppUser saved = repository.save(newUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<Object> updateRole(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String newRole = payload.get("role");
        if (newRole == null || newRole.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Yeni rol belirtilmelidir"));
        }

        Optional<AppUser> userOpt = repository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Kullanıcı bulunamadı"));
        }

        AppUser user = userOpt.get();
        user.setRole(newRole.trim().toUpperCase());
        AppUser updated = repository.save(user);

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Object> deleteUser(@PathVariable Long id) {
        Optional<AppUser> userOpt = repository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Kullanıcı bulunamadı"));
        }

        AppUser user = userOpt.get();
        if ("admin".equalsIgnoreCase(user.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ana yönetici hesabı silinemez!"));
        }

        repository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Kullanıcı sistemden başarıyla silindi", "id", id));
    }
}
