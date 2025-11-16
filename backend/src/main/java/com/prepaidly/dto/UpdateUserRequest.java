package com.prepaidly.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateUserRequest {
    @Email(message = "Email must be valid")
    private String email;
}

