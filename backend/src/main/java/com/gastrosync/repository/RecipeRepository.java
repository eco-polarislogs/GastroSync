package com.gastrosync.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.Recipe;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    // Eski veride ayni isimli kayit kalmis olabilir: tekil sonuc beklemeyen kontroller
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    Optional<Recipe> findFirstByNameIgnoreCase(String name);
    Optional<Recipe> findFirstByNameContainingIgnoreCase(String name);
    List<Recipe> findAllByOrderByCategoryAscNameAsc();
}
