package com.gastrosync.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.gastrosync.model.CheckItem;

@Repository
public interface CheckItemRepository extends JpaRepository<CheckItem, Long> {
    List<CheckItem> findByCheckIdOrderByIdAsc(Long checkId);
    List<CheckItem> findByCheckIdIn(Collection<Long> checkIds);
    List<CheckItem> findByStatusInOrderByAddedAtAsc(Collection<String> statuses);
}
