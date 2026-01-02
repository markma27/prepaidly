package com.prepaidly.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Create User Request DTO
 * 
 * Data Transfer Object for creating a new user account. Used as the request body
 * for the user creation endpoint.
 * 
 * This DTO contains the minimal information required to create a user - just the
 * email address. The user ID and creation timestamp are automatically generated
 * by the system.
 * 
 * @see UserResponse for the response DTO
 * @see com.prepaidly.controller.UserController#createUser(CreateUserRequest)
 */
@Data
public class CreateUserRequest {
    /**
     * User's email address
     * 
     * Must be a valid email format and unique across the system. This serves as
     * the primary identifier for the user account.
     * 
     * Validation:
     * - Required (cannot be blank)
     * - Must be a valid email format
     * - Must be unique (checked by controller)
     * 
     * Example: "user@example.com"
     */
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;
}

