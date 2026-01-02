package com.prepaidly.service;

import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Data initializer for development environment
 * 
 * This component is only active in the "local" profile to prevent automatic user creation
 * in production environments. It automatically creates a default user (demo@prepaidly.io)
 * for development and testing purposes.
 * 
 * Future Enhancements:
 * 1. Implement proper user registration:
 *    - Create UserController with registration endpoint (POST /api/users/register)
 *    - Add email validation and uniqueness checks
 *    - Implement password hashing (if adding password authentication)
 *    - Add email verification flow (optional but recommended)
 *    - Consider using OAuth2/OIDC for user authentication instead
 * 
 * 2. User Management:
 *    - Add user activation/deactivation functionality
 *    - Implement user profile management endpoints
 *    - Add user deletion/account closure functionality
 */
@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;

    @Override
    public void run(String... args) {
        // Create default user if not exists
        // NOTE: This is for development only - remove in production
        if (userRepository.findByEmail("demo@prepaidly.io").isEmpty()) {
            User defaultUser = new User();
            defaultUser.setEmail("demo@prepaidly.io");
            userRepository.save(defaultUser);
            log.info("Created default user: demo@prepaidly.io (ID: {})", defaultUser.getId());
        } else {
            log.info("Default user already exists");
        }
    }
}

