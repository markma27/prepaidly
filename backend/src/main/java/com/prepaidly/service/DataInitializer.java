package com.prepaidly.service;

import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Data initializer for development environment
 * 
 * TODO [PRODUCTION]: Remove this component and implement proper user registration
 * 
 * Current Behavior:
 * - Automatically creates a default user (demo@prepaidly.io) on application startup
 * - This is convenient for development/testing but is a security risk in production
 * 
 * Required Changes for Production:
 * 1. Remove or disable this component:
 *    - Option A: Remove @Component annotation and delete this class
 *    - Option B: Add @Profile("local") to only run in development
 *    - Option C: Add a feature flag to disable initialization
 * 
 * 2. Implement proper user registration:
 *    - Create UserController with registration endpoint (POST /api/users/register)
 *    - Add email validation and uniqueness checks
 *    - Implement password hashing (if adding password authentication)
 *    - Add email verification flow (optional but recommended)
 *    - Consider using OAuth2/OIDC for user authentication instead
 * 
 * 3. User Management:
 *    - Add user activation/deactivation functionality
 *    - Implement user profile management endpoints
 *    - Add user deletion/account closure functionality
 * 
 * Migration Path:
 * - Before removing: Ensure all existing users are migrated properly
 * - Update frontend to use registration endpoint instead of relying on default user
 * - Update API documentation to reflect new registration flow
 * - Test user registration flow thoroughly
 */
@Slf4j
@Component
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

