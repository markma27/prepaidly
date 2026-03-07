package com.prepaidly.service;

import com.prepaidly.dto.UserResponse;
import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service for user profile operations with caching.
 * Profile lookups by supabaseUserId are cached for 5 minutes to reduce DB load.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;

    @Cacheable(value = "userProfile", key = "#supabaseUserId", unless = "#result == null")
    public Optional<UserResponse> getProfileBySupabaseUserId(String supabaseUserId) {
        if (supabaseUserId == null || supabaseUserId.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findBySupabaseUserId(supabaseUserId)
                .map(this::toUserResponse);
    }

    private UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setDisplayName(user.getDisplayName());
        response.setRole(user.getRole() != null ? user.getRole() : "USER");
        response.setLastLogin(user.getLastLogin());
        response.setCreatedAt(user.getCreatedAt());
        return response;
    }
}
