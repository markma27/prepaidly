package com.prepaidly.controller;

import com.prepaidly.dto.CreateUserRequest;
import com.prepaidly.dto.UpdateUserRequest;
import com.prepaidly.dto.UserResponse;
import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /**
     * Create a new user
     * POST /api/users
     */
    @PostMapping
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserRequest request) {
        try {
            // Check if user with email already exists
            if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "User with email " + request.getEmail() + " already exists"));
            }

            User user = new User();
            user.setEmail(request.getEmail());
            user = userRepository.save(user);
            
            // Flush to ensure the insert happens before commit
            userRepository.flush();

            UserResponse response = toUserResponse(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            // Check if the error is about commit but user was actually created
            // This happens with connection pooler Transaction mode (autoCommit enabled)
            if (e.getMessage() != null && e.getMessage().contains("commit")) {
                // Try to verify if user was actually created despite commit error
                var createdUser = userRepository.findByEmail(request.getEmail());
                if (createdUser.isPresent()) {
                    log.warn("Commit failed but user was created: {}", request.getEmail());
                    UserResponse response = toUserResponse(createdUser.get());
                    return ResponseEntity.status(HttpStatus.CREATED).body(response);
                }
            }
            log.error("Error creating user", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to create user: " + e.getMessage()));
        }
    }

    /**
     * Get all users
     * GET /api/users
     */
    @GetMapping
    public ResponseEntity<?> getAllUsers() {
        try {
            List<User> users = userRepository.findAll();
            List<UserResponse> responses = users.stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(Map.of(
                "users", responses,
                "count", responses.size()
            ));
        } catch (Exception e) {
            log.error("Error fetching users", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch users: " + e.getMessage()));
        }
    }

    /**
     * Get user by ID
     * GET /api/users/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        try {
            User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
            
            UserResponse response = toUserResponse(user);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.error("User not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching user {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch user: " + e.getMessage()));
        }
    }

    /**
     * Get user by email
     * GET /api/users/email/{email}
     */
    @GetMapping("/email/{email}")
    public ResponseEntity<?> getUserByEmail(@PathVariable String email) {
        try {
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found with email: " + email));
            
            UserResponse response = toUserResponse(user);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.error("User not found: {}", email);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching user by email {}", email, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch user: " + e.getMessage()));
        }
    }

    /**
     * Update user
     * PUT /api/users/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        try {
            User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

            // Check if email is being changed and if new email already exists
            if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
                if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "User with email " + request.getEmail() + " already exists"));
                }
                user.setEmail(request.getEmail());
            }

            user = userRepository.save(user);
            UserResponse response = toUserResponse(user);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.error("User not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating user {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to update user: " + e.getMessage()));
        }
    }

    /**
     * Delete user
     * DELETE /api/users/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            if (!userRepository.existsById(id)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found with id: " + id));
            }

            userRepository.deleteById(id);
            return ResponseEntity.ok(Map.of(
                "message", "User deleted successfully",
                "id", id
            ));
        } catch (Exception e) {
            log.error("Error deleting user {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to delete user: " + e.getMessage()));
        }
    }

    /**
     * Convert User entity to UserResponse DTO
     */
    private UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setCreatedAt(user.getCreatedAt());
        return response;
    }
}

