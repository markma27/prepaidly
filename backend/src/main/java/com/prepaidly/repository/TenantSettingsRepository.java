package com.prepaidly.repository;

import com.prepaidly.model.TenantSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantSettingsRepository extends JpaRepository<TenantSettings, Long> {
    Optional<TenantSettings> findByTenantId(String tenantId);
}
