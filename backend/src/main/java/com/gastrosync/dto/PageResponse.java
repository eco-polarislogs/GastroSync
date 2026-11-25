package com.gastrosync.dto;

import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.springframework.data.domain.Page;

/**
 * Sayfalı liste yanıtı. page 0'dan başlar.
 * meta: sekme sayaçları, toplamlar gibi listeye eşlik eden özet bilgiler.
 */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages,
                              Map<String, Object> meta) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper, Map<String, Object> meta) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), meta == null ? Map.of() : meta);
    }

    public static <T> PageResponse<T> of(Page<T> page) {
        return of(page, Function.identity(), null);
    }

    /** İstemciden gelen sayfa parametrelerini güvenli aralığa çeker */
    public static int clampSize(Integer size) {
        if (size == null) return 20;
        return Math.max(5, Math.min(size, 100));
    }

    public static int clampPage(Integer page) {
        return page == null || page < 0 ? 0 : page;
    }

    /**
     * Istemcinin "alan,yon" (orn. "amount,desc") siralama istegini izinli alan listesine gore cevirir.
     * allowed: istemci alan adi -> entity alan adi. Bilinmeyen alanlar yok sayilir (fallback).
     * Esit degerlerde sayfa sirasinin kararli olmasi icin her zaman id ile ikincil siralama eklenir.
     */
    public static org.springframework.data.domain.Sort sort(String raw, Map<String, String> allowed,
                                                            org.springframework.data.domain.Sort fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        String[] parts = raw.split(",");
        String field = allowed.get(parts[0].trim());
        if (field == null) return fallback;
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());
        org.springframework.data.domain.Sort.Order order = desc
                ? org.springframework.data.domain.Sort.Order.desc(field)
                : org.springframework.data.domain.Sort.Order.asc(field);
        return "id".equals(field) ? org.springframework.data.domain.Sort.by(order)
                : org.springframework.data.domain.Sort.by(order, desc
                        ? org.springframework.data.domain.Sort.Order.desc("id")
                        : org.springframework.data.domain.Sort.Order.asc("id"));
    }
}
