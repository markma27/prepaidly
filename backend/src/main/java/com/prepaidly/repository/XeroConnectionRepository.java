package com.prepaidly.repository;

import com.prepaidly.model.XeroConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for XeroConnection entity operations.
 * Provides database access methods for Xero OAuth connections.
 */
@Repository
public interface XeroConnectionRepository extends JpaRepository<XeroConnection, Long> {
    /**
     * Find all Xero connections for a specific user.
     */
    List<XeroConnection> findByUserId(Long userId);
    
    /**
     * Find a Xero connection by tenant ID.
     * Returns the most recent connection if multiple exist (e.g. from reconnects).
     */
    Optional<XeroConnection> findFirstByTenantIdOrderByIdDesc(String tenantId);
    
    /**
     * Find all Xero connections for a tenant (multiple users may have connected the same org).
     */
    List<XeroConnection> findByTenantId(String tenantId);

    /**
     * Find a Xero connection by user ID and tenant ID.
     */
    Optional<XeroConnection> findByUserIdAndTenantId(Long userId, String tenantId);

    /**
     * Find all connections with a specific status (CONNECTED or DISCONNECTED).
     */
    List<XeroConnection> findByConnectionStatus(String connectionStatus);

    /**
     * Find all CONNECTED connections for a specific user.
     */
    List<XeroConnection> findByUserIdAndConnectionStatus(Long userId, String connectionStatus);
}

