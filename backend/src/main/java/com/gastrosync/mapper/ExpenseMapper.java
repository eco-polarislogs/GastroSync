package com.gastrosync.mapper;

import com.gastrosync.dto.expense.ExpenseCreateRequest;
import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.model.Expense;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.util.List;

/**
 * Enterprise MapStruct Mapper for Expense Entity <-> DTO conversions.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN & THESIS DEFENSE
 * ═══════════════════════════════════════════════════════════════
 *
 * WHY MAPSTRUCT IS SUPERIOR TO MODELMAPPER:
 * 1. ZERO REFLECTION AT RUNTIME:
 *    ModelMapper uses runtime Java reflection to inspect getters/setters on every request,
 *    introducing significant CPU and memory overhead under high concurrency.
 *    MapStruct generates pure, plain Java code during the Maven compile phase.
 *    Conversion performance is identical to hand-written code (nanoseconds).
 *
 * 2. COMPILE-TIME TYPE SAFETY:
 *    If an entity field name or type changes, MapStruct fails the Maven build IMMEDIATELY.
 *    With ModelMapper or manual reflection, property mismatches silently pass compilation
 *    and crash at runtime in production.
 *
 * 3. SPRING INTEGRATION (componentModel = "spring"):
 *    MapStruct annotates the generated implementation with @Component, making it
 *    directly injectable into Spring Services via standard constructor injection.
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = org.mapstruct.ReportingPolicy.IGNORE)
public interface ExpenseMapper {

    /**
     * Converts a creation request DTO into an Expense JPA Entity.
     */
    Expense toEntity(ExpenseCreateRequest request);

    /**
     * Converts an Expense JPA Entity into a client-safe response DTO.
     */
    ExpenseResponse toDto(Expense entity);

    /**
     * Batch conversion of Entity list into DTO list.
     */
    List<ExpenseResponse> toDtoList(List<Expense> entities);

    /**
     * Updates an existing JPA entity from a DTO, skipping null values.
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromDto(ExpenseCreateRequest request, @MappingTarget Expense entity);
}
