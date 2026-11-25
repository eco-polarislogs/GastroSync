package com.gastrosync.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.AppUser;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    /** Arsivlenmis (silinmis) kayitlar dahil kullanici adi var mi (benzersizlik kurali arsivi de kapsar) */
    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(:u)", nativeQuery = true)
    long countIncludingArchived(@org.springframework.data.repository.query.Param("u") String username);

    /** Demo modunda arsivlenmis demo hesabini geri yukler (rol ve demo sifresiyle) */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query(value = "UPDATE users SET is_deleted = false, deleted_at = NULL, deleted_by = NULL, "
            + "is_active = true, role = :role, password = :pw, must_change_password = false "
            + "WHERE LOWER(username) = LOWER(:u) AND is_deleted = true", nativeQuery = true)
    int restoreArchived(@org.springframework.data.repository.query.Param("u") String username,
                        @org.springframework.data.repository.query.Param("role") String role,
                        @org.springframework.data.repository.query.Param("pw") String passwordHash);
    List<AppUser> findByEmailIgnoreCase(String email);
    List<AppUser> findByRoleIgnoreCase(String role);
    List<AppUser> findAllByOrderByNameAsc();
}
