package com.prepaidly.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

/**
 * Update User Request DTO
 * 
 * Data Transfer Object for updating an existing user account. Used as the request
 * body for the user update endpoint.
 * 
 * This DTO supports partial updates - only fields that are provided will be updated.
 * Currently only supports updating the email address. All fields are optional to
 * allow for partial updates.
 * 
 * @see UserResponse for the response DTO
 * @see com.prepaidly.controller.UserController#updateUser(Long, UpdateUserRequest)
 */
@Data
public class UpdateUserRequest {
    /**
     * New email address for the user
     * 
     * If provided, must be a valid email format and unique across the system.
     * If null, the email will not be updated.
     * 
     * Validation:
     * - Optional (can be null for no change)
     * - If provided, must be a valid email format
     * - If provided, must be unique (checked by controller)
     * 
     * Example: "newemail@example.com"
     */
    @Email(message = "Email must be valid")
    private String email;
}

