package com.prepaidly.controller;

import com.prepaidly.dto.CreateUserRequest;
import com.prepaidly.dto.UpdateUserRequest;
import com.prepaidly.dto.UserResponse;
import com.prepaidly.dto.UserWithTenantRoleResponse;
import com.prepaidly.model.User;
import com.prepaidly.model.XeroConnection;
import com.prepaidly.repository.UserRepository;
import com.prepaidly.repository.XeroConnectionRepository;
import com.prepaidly.service.SupabaseAdminService;
import com.prepaidly.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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

    private static final java.util.Set<String> SUPER_ADMIN_EMAILS = java.util.Set.of(
        "mayinxing@gmail.com",
        "edmond.huo@prepaidly.io"
    );

    private final UserRepository userRepository;
    private final XeroConnectionRepository xeroConnectionRepository;
    private final SupabaseAdminService supabaseAdminService;
    private final UserProfileService userProfileService;
    private final com.prepaidly.service.JwtAuthService jwtAuthService;

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
     * Sync Users from Supabase Auth
     *
     * Pulls all users from Supabase Auth (using the service role key) and
     * overwrites the local users table to match Supabase as the source of truth.
     *
     * Notes:
     * - Users not present in Supabase are deleted locally.
     * - Local fields are overwritten on each sync.
     * - This should be protected in production (e.g., admin-only).
     *
     * @return Sync statistics: fetched, upserted, deleted
     */
    /** @deprecated Replaced by Xero-only login flow. Will be removed after migration verification. */
    @Deprecated
    @PostMapping("/sync-supabase")
    public ResponseEntity<?> syncSupabaseUsers(@RequestBody(required = false) Map<String, Object> body) {
        try {
            SupabaseAdminService.SyncResult result = supabaseAdminService.syncAllUsersFromSupabase(body);
            return ResponseEntity.ok(Map.of(
                "fetched", result.fetched(),
                "upserted", result.upserted(),
                "deleted", result.deleted()
            ));
        } catch (Exception e) {
            log.error("Failed to sync users from Supabase", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to sync users: " + e.getMessage()));
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
     * Get users who have access to the given entity (tenant).
     * Returns users that have a Xero connection for the given tenantId.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @GetMapping("/by-tenant")
    public ResponseEntity<?> getUsersByTenant(@RequestParam(required = false) String tenantId) {
        if (tenantId == null || tenantId.isBlank() || "null".equals(tenantId) || "undefined".equals(tenantId)) {
            return ResponseEntity.ok(Map.of(
                "users", List.of(),
                "count", 0
            ));
        }
        try {
            List<XeroConnection> connections = xeroConnectionRepository.findByTenantId(tenantId.trim());
            java.util.Map<Long, XeroConnection> userToConnection = connections.stream()
                .collect(Collectors.toMap(conn -> conn.getUser().getId(), conn -> conn, (a, b) -> a));
            Set<Long> userIds = userToConnection.keySet();
            List<User> users = userRepository.findAllById(userIds);
            List<UserWithTenantRoleResponse> responses = users.stream()
                .map(u -> toUserWithTenantRole(u, userToConnection.get(u.getId())))
                .collect(Collectors.toList());
            return ResponseEntity.ok(Map.of(
                "users", responses,
                "count", responses.size()
            ));
        } catch (Exception e) {
            log.error("Error fetching users by tenant", e);
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
     * Record user activity (login). Updates last_login and optionally display_name.
     *
     * @deprecated Replaced by Xero-only login flow which updates last_login during callback.
     */
    @Deprecated
    @PostMapping("/activity")
    public ResponseEntity<?> recordActivity(@RequestBody(required = false) Map<String, Object> body) {
        try {
            if (body == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            String supabaseUserId = Optional.ofNullable(body.get("supabaseUserId")).map(Object::toString).orElse(null);
            if (supabaseUserId == null || supabaseUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "supabaseUserId is required"));
            }
            String email = Optional.ofNullable(body.get("email")).map(Object::toString).orElse(null);
            String displayName = Optional.ofNullable(body.get("displayName")).map(Object::toString).orElse(null);
            if (displayName != null) displayName = displayName.isBlank() ? null : displayName;

            User user = userRepository.findBySupabaseUserId(supabaseUserId).orElseGet(() -> {
                User u = new User();
                u.setSupabaseUserId(supabaseUserId);
                String userEmail = email != null && !email.isBlank() ? email : "supabase-" + supabaseUserId + "@prepaidly.local";
                u.setEmail(userEmail);
                u.setRole(SUPER_ADMIN_EMAILS.contains(userEmail.toLowerCase()) ? "SYS_ADMIN" : "ORG_USER");
                return u;
            });
            user.setLastLogin(java.time.LocalDateTime.now());
            if (displayName != null) user.setDisplayName(displayName);
            if (email != null && !email.isBlank()) user.setEmail(email);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            log.error("Error recording activity", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to record activity: " + e.getMessage()));
        }
    }

    /**
     * Get current user profile.
     * Supports JWT-based auth (Authorization header) or legacy supabaseUserId param.
     * When tenantId is provided, computes effectiveRole (SUPER_ADMIN, ADMIN, GENERAL_USER).
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) String supabaseUserId,
            @RequestParam(required = false) String tenantId) {
        try {
            User user = null;

            // Try JWT-based auth first
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                Long userId = jwtAuthService.getUserIdFromToken(token);
                user = userRepository.findById(userId).orElse(null);
            }

            // Fallback: legacy supabaseUserId param
            if (user == null && supabaseUserId != null && !supabaseUserId.isBlank()) {
                user = userRepository.findBySupabaseUserId(supabaseUserId.trim()).orElse(null);
            }

            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found"));
            }

            UserResponse response = toUserResponse(user);

            if (tenantId != null && !tenantId.isBlank()) {
                XeroConnection connection = xeroConnectionRepository
                        .findByUserIdAndTenantId(user.getId(), tenantId.trim())
                        .orElse(null);
                response.setEffectiveRole(computeEffectiveRole(user, connection));
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching profile", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch profile: " + e.getMessage()));
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

            if (request.getDisplayName() != null) {
                user.setDisplayName(request.getDisplayName().isBlank() ? null : request.getDisplayName().trim());
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
     * Promote a general user to admin for the given tenant.
     * Only admins or super admins can promote. Only GENERAL_USER can be promoted to ADMIN.
     */
    @PatchMapping("/{id}/promote-to-admin")
    public ResponseEntity<?> promoteToAdmin(
            @PathVariable Long id,
            @RequestParam String tenantId) {
        if (tenantId == null || tenantId.isBlank() || "null".equals(tenantId) || "undefined".equals(tenantId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "tenantId is required"));
        }
        try {
            XeroConnection connection = xeroConnectionRepository.findByUserIdAndTenantId(id, tenantId.trim())
                .orElse(null);
            if (connection == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User does not have access to this entity"));
            }
            if (connection.isOrgAdmin()) {
                return ResponseEntity.ok(Map.of("message", "User is already an admin"));
            }
            connection.setOrgAdmin(true);
            xeroConnectionRepository.save(connection);
            return ResponseEntity.ok(Map.of("message", "User promoted to admin successfully"));
        } catch (Exception e) {
            log.error("Error promoting user {} to admin", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to promote user: " + e.getMessage()));
        }
    }

    /**
     * Demote an admin back to general user for the given tenant.
     * Only admins or super admins can demote.
     */
    @PatchMapping("/{id}/demote-to-user")
    public ResponseEntity<?> demoteToUser(
            @PathVariable Long id,
            @RequestParam String tenantId) {
        if (tenantId == null || tenantId.isBlank() || "null".equals(tenantId) || "undefined".equals(tenantId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "tenantId is required"));
        }
        try {
            XeroConnection connection = xeroConnectionRepository.findByUserIdAndTenantId(id, tenantId.trim())
                .orElse(null);
            if (connection == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User does not have access to this entity"));
            }
            if (!connection.isOrgAdmin()) {
                return ResponseEntity.ok(Map.of("message", "User is already a general user"));
            }
            connection.setOrgAdmin(false);
            xeroConnectionRepository.save(connection);
            return ResponseEntity.ok(Map.of("message", "User demoted to general user successfully"));
        } catch (Exception e) {
            log.error("Error demoting user {} to general user", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to demote user: " + e.getMessage()));
        }
    }

    /**
     * Convert User entity to UserResponse DTO
     */
    private UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setDisplayName(user.getDisplayName());
        response.setRole(user.getRole());
        response.setLastLogin(user.getLastLogin());
        response.setCreatedAt(user.getCreatedAt());
        return response;
    }

    private UserWithTenantRoleResponse toUserWithTenantRole(User user, XeroConnection connection) {
        UserWithTenantRoleResponse r = new UserWithTenantRoleResponse();
        r.setId(user.getId());
        r.setEmail(user.getEmail());
        r.setDisplayName(user.getDisplayName());
        r.setRole(user.getRole());
        r.setLastLogin(user.getLastLogin());
        r.setCreatedAt(user.getCreatedAt());
        String effectiveRole = computeEffectiveRole(user, connection);
        r.setEffectiveRole(effectiveRole);
        return r;
    }

    private String computeEffectiveRole(User user, XeroConnection connection) {
        if (user.getEmail() != null && SUPER_ADMIN_EMAILS.contains(user.getEmail().toLowerCase())) {
            return "SUPER_ADMIN";
        }
        if ("SYS_ADMIN".equals(user.getRole())) {
            return "SUPER_ADMIN";
        }
        if (connection != null && connection.isOrgAdmin()) {
            return "ADMIN";
        }
        return "GENERAL_USER";
    }
}

