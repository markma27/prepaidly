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
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * User Controller
 * 
 * REST controller for managing user accounts in the Prepaidly system. Provides
 * full CRUD (Create, Read, Update, Delete) operations for user management.
 * 
 * Users are identified by their email address, which must be unique across the system.
 * Each user has:
 * - A unique ID (auto-generated)
 * - An email address (required, unique)
 * - A creation timestamp (auto-set on creation)
 * 
 * The controller handles:
 * - User registration/creation
 * - User lookup by ID or email
 * - User information updates
 * - User deletion
 * 
 * All endpoints return UserResponse DTOs containing user information. The controller
 * includes validation to ensure email uniqueness and proper error handling for
 * various failure scenarios.
 * 
 * Note: This is a basic user management system. In production, you may want to add:
 * - Authentication and authorization
 * - Password management
 * - User roles and permissions
 * - Email verification
 * - Soft delete instead of hard delete
 */
@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /**
     * Create a New User
     * 
     * Creates a new user account with the provided email address. The email must
     * be unique - if a user with the same email already exists, the request will
     * be rejected with a conflict status.
     * 
     * Upon successful creation:
     * - A unique ID is automatically generated
     * - The creation timestamp is set to the current time
     * - The user is persisted to the database
     * 
     * @param request CreateUserRequest containing:
     *                - email: The user's email address (required, must be valid email format, must be unique)
     * 
     * @return ResponseEntity with UserResponse or error:
     *         - Success (201 Created): Returns UserResponse containing:
     *           {
     *             "id": <user-id>,
     *             "email": "<email-address>",
     *             "createdAt": "<timestamp>"
     *           }
     *         - Conflict (409): Returns error if email already exists:
     *           {
     *             "error": "User with email <email> already exists"
     *           }
     *         - Bad Request (400): Returns error if validation fails
     *         - Internal Server Error (500): Returns error if creation fails
     * 
     * @apiNote POST /api/users
     * 
     * @throws IllegalArgumentException if email validation fails
     * @throws Exception if database operation fails (with workaround for connection pooler issues)
     * 
     * @example Request:
     * {
     *   "email": "user@example.com"
     * }
     * 
     * @example Success Response:
     * {
     *   "id": 1,
     *   "email": "user@example.com",
     *   "createdAt": "2025-01-15T10:30:00"
     * }
     * 
     * @example Error Response (Duplicate Email):
     * {
     *   "error": "User with email user@example.com already exists"
     * }
     * 
     * @usage Use this endpoint to register new users in the system. The email
     *        address serves as the unique identifier for users.
     * 
     * @note Includes a workaround for connection pooler autoCommit issues where
     *       the commit may fail but the user is actually created. The method
     *       checks if the user exists despite commit errors and returns success.
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
     * Get All Users
     * 
     * Retrieves a list of all users in the system. Returns all user records
     * with their basic information (ID, email, creation timestamp).
     * 
     * This endpoint is useful for:
     * - Admin dashboards showing all users
     * - User management interfaces
     * - System audits and reporting
     * 
     * @return ResponseEntity with list of users or error:
     *         - Success (200 OK): Returns JSON with:
     *           {
     *             "users": [
     *               {
     *                 "id": 1,
     *                 "email": "user1@example.com",
     *                 "createdAt": "2025-01-15T10:30:00"
     *               },
     *               {
     *                 "id": 2,
     *                 "email": "user2@example.com",
     *                 "createdAt": "2025-01-16T14:20:00"
     *               }
     *             ],
     *             "count": 2
     *           }
     *         - Internal Server Error (500): Returns error if fetch fails
     * 
     * @apiNote GET /api/users
     * 
     * @example Request:
     * GET /api/users
     * 
     * @example Success Response:
     * {
     *   "users": [
     *     {"id": 1, "email": "user@example.com", "createdAt": "2025-01-15T10:30:00"}
     *   ],
     *   "count": 1
     * }
     * 
     * @usage Use this endpoint to retrieve all users. The response includes a
     *        count field for convenience. For large user bases, consider adding
     *        pagination in the future.
     * 
     * @note In production, you may want to add:
     *       - Pagination (page, size parameters)
     *       - Filtering (by email, date range)
     *       - Sorting (by creation date, email)
     *       - Authorization (only admins can view all users)
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
     * Get User by ID
     * 
     * Retrieves a specific user by their unique identifier. Returns the complete
     * user information including ID, email, and creation timestamp.
     * 
     * @param id The unique identifier of the user (required)
     * 
     * @return ResponseEntity with UserResponse or error:
     *         - Success (200 OK): Returns UserResponse containing:
     *           {
     *             "id": <user-id>,
     *             "email": "<email-address>",
     *             "createdAt": "<timestamp>"
     *           }
     *         - Not Found (404): Returns error if user doesn't exist:
     *           {
     *             "error": "User not found with id: <id>"
     *           }
     *         - Internal Server Error (500): Returns error if fetch fails
     * 
     * @apiNote GET /api/users/{id}
     * 
     * @throws RuntimeException if user not found
     * 
     * @example Request:
     * GET /api/users/123
     * 
     * @example Success Response:
     * {
     *   "id": 123,
     *   "email": "user@example.com",
     *   "createdAt": "2025-01-15T10:30:00"
     * }
     * 
     * @example Error Response (Not Found):
     * {
     *   "error": "User not found with id: 999"
     * }
     * 
     * @usage Use this endpoint to retrieve a specific user when you know their ID.
     *        This is useful for user profile pages or when referencing users by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        try {
            User user = Objects.requireNonNull(
                userRepository.findById(Objects.requireNonNull(id, "User ID cannot be null"))
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + id)),
                "User cannot be null"
            );
            
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
     * Get User by Email
     * 
     * Retrieves a user by their email address. Since email addresses are unique
     * in the system, this endpoint can be used to look up users when you only
     * know their email (e.g., during login or email-based operations).
     * 
     * @param email The email address of the user (required)
     * 
     * @return ResponseEntity with UserResponse or error:
     *         - Success (200 OK): Returns UserResponse containing:
     *           {
     *             "id": <user-id>,
     *             "email": "<email-address>",
     *             "createdAt": "<timestamp>"
     *           }
     *         - Not Found (404): Returns error if user doesn't exist:
     *           {
     *             "error": "User not found with email: <email>"
     *           }
     *         - Internal Server Error (500): Returns error if fetch fails
     * 
     * @apiNote GET /api/users/email/{email}
     * 
     * @throws RuntimeException if user not found
     * 
     * @example Request:
     * GET /api/users/email/user@example.com
     * 
     * @example Success Response:
     * {
     *   "id": 123,
     *   "email": "user@example.com",
     *   "createdAt": "2025-01-15T10:30:00"
     * }
     * 
     * @example Error Response (Not Found):
     * {
     *   "error": "User not found with email: unknown@example.com"
     * }
     * 
     * @usage Use this endpoint when you need to look up a user by email address.
     *        This is commonly used for:
     *        - Login/authentication flows
     *        - Email verification
     *        - User lookup in email-based workflows
     * 
     * @note The email is case-sensitive. Consider normalizing emails (lowercase)
     *       in production to avoid case-sensitivity issues.
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
     * Update User
     * 
     * Updates an existing user's information. Currently supports updating the
     * email address. If the email is being changed, the new email must be unique
     * and not already associated with another user.
     * 
     * The update operation:
     * - Validates that the user exists
     * - Checks if email is being changed
     * - Verifies the new email is unique (if changed)
     * - Updates and saves the user
     * 
     * @param id The unique identifier of the user to update (required)
     * @param request UpdateUserRequest containing:
     *                - email: New email address (optional, must be unique if provided)
     * 
     * @return ResponseEntity with UserResponse or error:
     *         - Success (200 OK): Returns updated UserResponse containing:
     *           {
     *             "id": <user-id>,
     *             "email": "<updated-email>",
     *             "createdAt": "<original-creation-timestamp>"
     *           }
     *         - Not Found (404): Returns error if user doesn't exist:
     *           {
     *             "error": "User not found with id: <id>"
     *           }
     *         - Conflict (409): Returns error if new email already exists:
     *           {
     *             "error": "User with email <email> already exists"
     *           }
     *         - Bad Request (400): Returns error if validation fails
     *         - Internal Server Error (500): Returns error if update fails
     * 
     * @apiNote PUT /api/users/{id}
     * 
     * @throws RuntimeException if user not found
     * @throws IllegalArgumentException if email validation fails
     * 
     * @example Request:
     * PUT /api/users/123
     * {
     *   "email": "newemail@example.com"
     * }
     * 
     * @example Success Response:
     * {
     *   "id": 123,
     *   "email": "newemail@example.com",
     *   "createdAt": "2025-01-15T10:30:00"
     * }
     * 
     * @example Error Response (Not Found):
     * {
     *   "error": "User not found with id: 999"
     * }
     * 
     * @example Error Response (Duplicate Email):
     * {
     *   "error": "User with email existing@example.com already exists"
     * }
     * 
     * @usage Use this endpoint to update user information. Currently only email
     *        can be updated. The creation timestamp is preserved and cannot be changed.
     * 
     * @note In production, you may want to add:
     *       - Additional fields (name, phone, preferences, etc.)
     *       - Partial updates (PATCH instead of PUT)
     *       - Audit logging for changes
     *       - Email change verification workflow
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        try {
            User user = Objects.requireNonNull(
                userRepository.findById(Objects.requireNonNull(id, "User ID cannot be null"))
                    .orElseThrow(() -> new RuntimeException("User not found with id: " + id)),
                "User cannot be null"
            );

            // Check if email is being changed and if new email already exists
            if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
                if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "User with email " + request.getEmail() + " already exists"));
                }
                user.setEmail(request.getEmail());
            }

            user = Objects.requireNonNull(userRepository.save(user), "Saved user cannot be null");
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
     * Delete User
     * 
     * Permanently deletes a user from the system. This is a hard delete operation
     * that removes the user record from the database. The operation cannot be undone.
     * 
     * Before deletion:
     * - Verifies the user exists
     * - Performs the deletion
     * - Returns confirmation
     * 
     * @param id The unique identifier of the user to delete (required)
     * 
     * @return ResponseEntity with deletion confirmation or error:
     *         - Success (200 OK): Returns confirmation:
     *           {
     *             "message": "User deleted successfully",
     *             "id": <deleted-user-id>
     *           }
     *         - Not Found (404): Returns error if user doesn't exist:
     *           {
     *             "error": "User not found with id: <id>"
     *           }
     *         - Internal Server Error (500): Returns error if deletion fails
     * 
     * @apiNote DELETE /api/users/{id}
     * 
     * @example Request:
     * DELETE /api/users/123
     * 
     * @example Success Response:
     * {
     *   "message": "User deleted successfully",
     *   "id": 123
     * }
     * 
     * @example Error Response (Not Found):
     * {
     *   "error": "User not found with id: 999"
     * }
     * 
     * @usage Use this endpoint to permanently remove a user from the system.
     *        Exercise caution as this operation cannot be undone.
     * 
     * @warning This is a hard delete operation. Once deleted, the user and all
     *          associated data are permanently removed. In production, consider:
     *          - Soft delete (mark as deleted instead of removing)
     *          - Cascading delete rules for related data
     *          - Authorization (only admins can delete users)
     *          - Audit logging for deletions
     *          - Data retention policies
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            Long idNonNull = Objects.requireNonNull(id, "User ID cannot be null");
            if (!userRepository.existsById(idNonNull)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found with id: " + idNonNull));
            }

            userRepository.deleteById(idNonNull);
            return ResponseEntity.ok(Map.of(
                "message", "User deleted successfully",
                "id", idNonNull
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

