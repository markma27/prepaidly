package com.prepaidly.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * User response with effective role for a specific tenant.
 * effectiveRole: SUPER_ADMIN | ADMIN | GENERAL_USER
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserWithTenantRoleResponse {
    private Long id;
    private String email;
    private String displayName;
    private String role;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    /** Effective role for this tenant: SUPER_ADMIN, ADMIN, or GENERAL_USER */
    private String effectiveRole;
}
