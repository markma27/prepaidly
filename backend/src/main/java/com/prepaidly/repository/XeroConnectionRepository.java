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
     * 
     * @param userId The user ID
     * @return List of Xero connections for the user
     */
    List<XeroConnection> findByUserId(Long userId);
    
    /**
     * Find a Xero connection by tenant ID.
     * 
     * @param tenantId The Xero tenant/organization ID
     * @return Optional containing the connection if found, empty otherwise
     */
    Optional<XeroConnection> findByTenantId(String tenantId);
    
    /**
     * Find a Xero connection by user ID and tenant ID.
     * 
     * @param userId The user ID
     * @param tenantId The Xero tenant/organization ID
     * @return Optional containing the connection if found, empty otherwise
     */
    Optional<XeroConnection> findByUserIdAndTenantId(Long userId, String tenantId);
}

