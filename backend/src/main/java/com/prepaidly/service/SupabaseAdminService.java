package com.prepaidly.service;

import com.prepaidly.model.User;
import com.prepaidly.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.core.ParameterizedTypeReference;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Syncs Supabase Auth users into the local users table.
 *
 * Uses the Supabase Admin API (service role key) to fetch all auth users,
 * then upserts local users and removes any that no longer exist in Supabase.
 *
 * @deprecated Replaced by Xero-only login. User creation/sync now happens
 *             via XeroOAuthService.exchangeCodeForLoginTokens(). Keep this file
 *             until the migration is fully verified.
 */
@Deprecated
@Slf4j
@Service
@RequiredArgsConstructor
public class SupabaseAdminService {

    private static final int PAGE_SIZE = 100;

    private final RestTemplate restTemplate;
    private final UserRepository userRepository;

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.serviceRoleKey:}")
    private String supabaseServiceRoleKey;

    public record SyncResult(int fetched, int upserted, int deleted) {}

    /**
     * Optional body from frontend: { supabaseUserId, displayName }.
     * When provided, enriches the synced user with session data (e.g., display name, last login = now).
     * Use when Supabase Admin API returns null for these fields (timing/API quirks).
     */
    @SuppressWarnings("null")
    public SyncResult syncAllUsersFromSupabase(java.util.Map<String, Object> enrichBody) {
        List<Map<String, Object>> supabaseUsers = fetchAllSupabaseUsers();
        if (supabaseUsers.isEmpty()) {
            throw new IllegalStateException("Supabase returned no users. Sync aborted to avoid deleting local data.");
        }

        Set<String> supabaseIds = supabaseUsers.stream()
            .map(u -> Optional.ofNullable(u.get("id")).map(Object::toString).orElse(null))
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        int upserted = 0;
        for (Map<String, Object> userMap : supabaseUsers) {
            String supabaseUserId = Optional.ofNullable(userMap.get("id")).map(Object::toString).orElse(null);
            if (supabaseUserId == null || supabaseUserId.isBlank()) {
                continue;
            }
            User user = userRepository.findBySupabaseUserId(supabaseUserId)
                .orElseGet(User::new);
            applySupabaseUser(user, userMap);
            // Enrich with session data if frontend passed it (e.g. right after login)
            if (enrichBody != null) {
                String enrichId = Optional.ofNullable(enrichBody.get("supabaseUserId")).map(Object::toString).orElse(null);
                if (supabaseUserId.equals(enrichId)) {
                    enrichFromSession(user, enrichBody);
                }
            }
            userRepository.save(user);
            upserted++;
        }

        // Remove local users that no longer exist in Supabase
        int deleted = deleteUsersNotInSupabase(supabaseIds);

        return new SyncResult(supabaseUsers.size(), upserted, deleted);
    }

    @SuppressWarnings("null")
    private List<Map<String, Object>> fetchAllSupabaseUsers() {
        if (supabaseUrl == null || supabaseUrl.isBlank()) {
            throw new IllegalStateException("supabase.url is not configured");
        }
        if (supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            throw new IllegalStateException("supabase.serviceRoleKey is not configured");
        }

        List<Map<String, Object>> allUsers = new ArrayList<>();
        int page = 1;
        while (true) {
            String url = String.format("%s/auth/v1/admin/users?page=%d&per_page=%d", supabaseUrl, page, PAGE_SIZE);
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseServiceRoleKey);
            headers.set("apikey", supabaseServiceRoleKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<>() {}
            );
            Map<String, Object> body = response.getBody();
            if (body == null || !body.containsKey("users")) {
                break;
            }

            Object usersObj = body.get("users");
            if (!(usersObj instanceof List<?> usersList)) {
                break;
            }

            int before = allUsers.size();
            for (Object item : usersList) {
                if (item instanceof Map<?, ?> map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> typed = (Map<String, Object>) map;
                    allUsers.add(typed);
                }
            }

            if (allUsers.size() == before || usersList.size() < PAGE_SIZE) {
                break;
            }
            page++;
        }

        log.info("Fetched {} users from Supabase", allUsers.size());
        return allUsers;
    }

    private static final java.util.Set<String> SUPER_ADMIN_EMAILS = java.util.Set.of(
        "mayinxing@gmail.com",
        "edmond.huo@prepaidly.io"
    );

    private void applySupabaseUser(User user, Map<String, Object> userMap) {
        String supabaseUserId = Optional.ofNullable(userMap.get("id")).map(Object::toString).orElse(null);
        user.setSupabaseUserId(supabaseUserId);

        String email = Optional.ofNullable(userMap.get("email")).map(Object::toString).orElse(null);
        if (email == null || email.isBlank()) {
            email = "supabase-" + supabaseUserId + "@prepaidly.local";
        }
        user.setEmail(email);

        // Display name from user_metadata or raw_user_meta_data (GoTrue uses both)
        user.setDisplayName(extractDisplayName(userMap));

        // Role: super admin emails always SYS_ADMIN; else from metadata or default ORG_USER
        if (email != null && SUPER_ADMIN_EMAILS.contains(email.toLowerCase())) {
            user.setRole("SYS_ADMIN");
        } else {
            user.setRole(extractRole(userMap));
        }

        // Last login: user-level last_sign_in_at, or fallback to first identity's last_sign_in_at
        user.setLastLogin(parseLocalDateTime(extractLastSignInAt(userMap)));

        // Keep created_at from Supabase and always refresh synced_at on each sync
        user.setSupabaseCreatedAt(parseOffsetDate(userMap.get("created_at")));
        user.setSupabaseSyncedAt(OffsetDateTime.now());
    }

    private String extractDisplayName(Map<String, Object> userMap) {
        Map<String, Object> meta = getMetadataMap(userMap);
        if (meta != null) {
            String fullName = Optional.ofNullable(meta.get("full_name")).map(Object::toString).orElse(null);
            if (fullName != null && !fullName.isBlank()) return fullName;
            String name = Optional.ofNullable(meta.get("name")).map(Object::toString).orElse(null);
            if (name != null && !name.isBlank()) return name;
        }
        return null;
    }

    private String extractRole(Map<String, Object> userMap) {
        Map<String, Object> meta = getMetadataMap(userMap);
        if (meta != null) {
            String role = Optional.ofNullable(meta.get("role")).map(Object::toString).orElse(null);
            if (role != null && !role.isBlank()) {
                String r = role.toUpperCase();
                if ("SYS_ADMIN".equals(r) || "ORG_ADMIN".equals(r) || "ORG_USER".equals(r)) {
                    return r;
                }
            }
        }
        return "ORG_USER";
    }

    /** Get user metadata from user_metadata or raw_user_meta_data (GoTrue uses both across versions). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getMetadataMap(Map<String, Object> userMap) {
        Object meta = userMap.get("user_metadata");
        if (meta instanceof Map<?, ?>) return (Map<String, Object>) meta;
        meta = userMap.get("raw_user_meta_data");
        if (meta instanceof Map<?, ?>) return (Map<String, Object>) meta;
        return null;
    }

    private void enrichFromSession(User user, Map<String, Object> body) {
        // Display name from session (Supabase session has user_metadata)
        if (user.getDisplayName() == null || user.getDisplayName().isBlank()) {
            String dn = Optional.ofNullable(body.get("displayName")).map(Object::toString).orElse(null);
            if (dn != null && !dn.isBlank()) user.setDisplayName(dn);
        }
        // Always update last login on login flow (session = just signed in)
        user.setLastLogin(java.time.LocalDateTime.now());
    }

    /** Get last_sign_in_at from user or first identity (Supabase may nest it in identities). */
    private Object extractLastSignInAt(Map<String, Object> userMap) {
        Object at = userMap.get("last_sign_in_at");
        if (at != null) return at;
        Object identities = userMap.get("identities");
        if (identities instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> idMap) {
                return ((Map<?, ?>) first).get("last_sign_in_at");
            }
        }
        return null;
    }

    private LocalDateTime parseLocalDateTime(Object value) {
        if (value == null) return null;
        String raw = value.toString();
        if (raw.isBlank()) return null;
        try {
            OffsetDateTime odt = OffsetDateTime.parse(raw);
            return odt.toLocalDateTime();
        } catch (Exception e) {
            return null;
        }
    }

    private OffsetDateTime parseOffsetDate(Object value) {
        if (value == null) return null;
        String raw = value.toString();
        if (raw.isBlank()) return null;
        try {
            return OffsetDateTime.parse(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private int deleteUsersNotInSupabase(Set<String> supabaseIds) {
        if (supabaseIds.isEmpty()) {
            return 0;
        }

        List<User> usersToDelete = new ArrayList<>();
        usersToDelete.addAll(userRepository.findBySupabaseUserIdIsNull());
        usersToDelete.addAll(userRepository.findBySupabaseUserIdNotIn(supabaseIds));

        if (usersToDelete.isEmpty()) {
            return 0;
        }

        int count = usersToDelete.size();
        userRepository.deleteAll(usersToDelete);
        return count;
    }
}
