package com.gastrosync.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gastrosync.model.CheckPayment;

public interface CheckPaymentRepository extends JpaRepository<CheckPayment, Long> {

    List<CheckPayment> findByCheckIdAndVoidedFalseOrderByPaidAtAscIdAsc(Long checkId);

    List<CheckPayment> findByCheckIdOrderByPaidAtAscIdAsc(Long checkId);

    List<CheckPayment> findByCheckNoInAndVoidedFalse(Collection<String> checkNos);
}
