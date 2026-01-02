package com.prepaidly.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * OAuth State Cache Service
 * 
 * Manages OAuth2 state parameters for CSRF protection. State values are stored
 * temporarily (default: 10 minutes) and associated with a user ID to prevent
 * cross-site request forgery attacks during the OAuth flow.
 * 
 * Security Features:
 * - State values are unique UUIDs
 * - State is associated with userId to prevent cross-user attacks
 * - Automatic expiration after 10 minutes
 * - Periodic cleanup of expired entries
 * 
 * Usage:
 * 1. Generate and store state: storeState(userId) -> returns state string
 * 2. Validate state: validateState(state, userId) -> returns true if valid
 * 3. State is automatically cleaned up after expiration
 */
@Slf4j
@Service
public class OAuthStateCache {
    
    /**
     * State entry containing userId and expiration time
     */
    private static class StateEntry {
        private final Long userId;
        private final LocalDateTime expiresAt;
        
        public StateEntry(Long userId, LocalDateTime expiresAt) {
            this.userId = userId;
            this.expiresAt = expiresAt;
        }
        
        public Long getUserId() {
            return userId;
        }
        
        public boolean isExpired() {
            return LocalDateTime.now().isAfter(expiresAt);
        }
    }
    
    // Store state -> StateEntry mapping
    private final Map<String, StateEntry> stateCache = new ConcurrentHashMap<>();
    
    // State expiration time in minutes
    private static final int STATE_EXPIRATION_MINUTES = 10;
    
    // Cleanup interval in minutes
    private static final int CLEANUP_INTERVAL_MINUTES = 5;
    
    private final ScheduledExecutorService cleanupScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "oauth-state-cache-cleanup");
        t.setDaemon(true);
        return t;
    });
    
    public OAuthStateCache() {
        // Start periodic cleanup of expired states
        cleanupScheduler.scheduleAtFixedRate(
            this::cleanupExpiredStates,
            CLEANUP_INTERVAL_MINUTES,
            CLEANUP_INTERVAL_MINUTES,
            TimeUnit.MINUTES
        );
        log.info("OAuth State Cache initialized with {} minute expiration", STATE_EXPIRATION_MINUTES);
    }
    
    /**
     * Generate and store a new state for the given user
     * 
     * @param userId The user ID associated with this OAuth flow
     * @return A unique state string that should be included in the OAuth authorization URL
     */
    public String storeState(Long userId) {
        String state = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(STATE_EXPIRATION_MINUTES);
        
        stateCache.put(state, new StateEntry(userId, expiresAt));
        log.debug("Stored OAuth state for user {}: {} (expires at {})", userId, state, expiresAt);
        
        return state;
    }
    
    /**
     * Validate a state parameter for the given user
     * 
     * @param state The state parameter received from OAuth callback
     * @param userId The user ID to validate against
     * @return true if state is valid and matches the user, false otherwise
     */
    public boolean validateState(String state, Long userId) {
        if (state == null || state.isEmpty()) {
            log.warn("State validation failed: state is null or empty");
            return false;
        }
        
        StateEntry entry = stateCache.get(state);
        if (entry == null) {
            log.warn("State validation failed: state not found in cache: {}", state);
            return false;
        }
        
        if (entry.isExpired()) {
            log.warn("State validation failed: state expired for user {}: {}", userId, state);
            stateCache.remove(state); // Remove expired entry
            return false;
        }
        
        if (!entry.getUserId().equals(userId)) {
            log.warn("State validation failed: userId mismatch. Expected: {}, Got: {}, State: {}", 
                entry.getUserId(), userId, state);
            return false;
        }
        
        // State is valid - remove it to prevent reuse (one-time use)
        stateCache.remove(state);
        log.debug("State validated successfully for user {}: {}", userId, state);
        return true;
    }
    
    /**
     * Remove a state from cache (e.g., after successful validation)
     */
    public void removeState(String state) {
        stateCache.remove(state);
    }
    
    /**
     * Clean up expired states from the cache
     */
    private void cleanupExpiredStates() {
        int initialSize = stateCache.size();
        stateCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
        int removed = initialSize - stateCache.size();
        if (removed > 0) {
            log.debug("Cleaned up {} expired OAuth states. Remaining: {}", removed, stateCache.size());
        }
    }
    
    /**
     * Get current cache size (for monitoring/debugging)
     */
    public int getCacheSize() {
        return stateCache.size();
    }
}

