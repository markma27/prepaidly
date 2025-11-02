package com.prepaidly.service;

import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Initialize default user for development
 * TODO: Remove this in production and implement proper user registration
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;

    @Override
    public void run(String... args) {
        // Create default user if not exists
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

