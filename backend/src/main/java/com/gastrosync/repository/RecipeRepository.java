package com.gastrosync.repository;

import com.gastrosync.model.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long> {
    Optional<Recipe> findByNameIgnoreCase(String name);
    Optional<Recipe> findFirstByNameIgnoreCase(String name);
    Optional<Recipe> findFirstByNameContainingIgnoreCase(String name);
}
