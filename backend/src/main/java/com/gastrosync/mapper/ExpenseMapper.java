package com.gastrosync.mapper;

import java.util.List;

import org.mapstruct.Mapper;

import com.gastrosync.dto.expense.ExpenseResponse;
import com.gastrosync.model.Expense;

/**
 * Entity -> DTO projeksiyonu. Yazma yonu (DTO -> Entity) bilincli olarak ExpenseService'te
 * elle yapilir; boylece durum / odeme / onay alanlari istemci tarafindan degistirilemez.
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = org.mapstruct.ReportingPolicy.IGNORE)
public interface ExpenseMapper {
    ExpenseResponse toDto(Expense entity);
    List<ExpenseResponse> toDtoList(List<Expense> entities);
}
