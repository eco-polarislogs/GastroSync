package com.gastrosync.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.gastrosync.model.FiscalDocument;

public interface FiscalDocumentRepository extends JpaRepository<FiscalDocument, Long> {

    List<FiscalDocument> findByCheckIdOrderByCreatedAtAsc(Long checkId);

    List<FiscalDocument> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime from, LocalDateTime to);

    List<FiscalDocument> findByCheckIdInAndStatusNot(Collection<Long> checkIds, String status);

    @Query("select max(d.documentNo) from FiscalDocument d where d.type = 'E_ARSIV' and d.documentNo like concat(:prefix, '%')")
    String maxDocumentNo(@org.springframework.data.repository.query.Param("prefix") String prefix);
}
