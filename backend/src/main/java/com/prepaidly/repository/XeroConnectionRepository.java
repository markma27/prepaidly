package com.prepaidly.repository;

import com.prepaidly.model.XeroConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface XeroConnectionRepository extends JpaRepository<XeroConnection, Long> {
    List<XeroConnection> findByUserId(Long userId);
    Optional<XeroConnection> findByTenantId(String tenantId);
    Optional<XeroConnection> findByUserIdAndTenantId(Long userId, String tenantId);
}

