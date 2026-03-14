package com.prepaidly.repository;

import com.prepaidly.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for User entity operations.
 * Provides database access methods for user management.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    /**
     * Find a user by email address.
     * 
     * @param email The email address to search for
     * @return Optional containing the user if found, empty otherwise
     */
    Optional<User> findByEmail(String email);

    /**
     * Find a user by Supabase UUID.
     *
     * @param supabaseUserId Supabase user UUID
     * @return Optional containing the user if found, empty otherwise
     */
    @Deprecated
    Optional<User> findBySupabaseUserId(String supabaseUserId);

    /**
     * Find a user by Xero user ID.
     *
     * @param xeroUserId Xero user ID
     * @return Optional containing the user if found, empty otherwise
     */
    Optional<User> findByXeroUserId(String xeroUserId);

    /**
     * Find users whose Supabase UUID is not in the provided set.
     *
     * @param supabaseUserIds Supabase user UUIDs to keep
     * @return users not in the set
     */
    @Deprecated
    java.util.List<User> findBySupabaseUserIdNotIn(java.util.Collection<String> supabaseUserIds);

    /**
     * Find users that do not have a Supabase UUID (legacy data).
     *
     * @return users without Supabase UUID
     */
    @Deprecated
    java.util.List<User> findBySupabaseUserIdIsNull();
}

