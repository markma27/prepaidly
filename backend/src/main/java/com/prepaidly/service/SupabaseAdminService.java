package com.prepaidly.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SupabaseAdminService {

    private static final int PAGE_SIZE = 100;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.serviceRoleKey:}")
    private String supabaseServiceRoleKey;

    public record SyncResult(int fetched, int upserted, int deleted) {}

    public SyncResult syncAllUsersFromSupabase() {
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
            userRepository.save(user);
            upserted++;
        }

        // Remove local users that no longer exist in Supabase
        int deleted = deleteUsersNotInSupabase(supabaseIds);

        return new SyncResult(supabaseUsers.size(), upserted, deleted);
    }

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

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<?, ?> body = response.getBody();
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
                    //noinspection unchecked
                    allUsers.add((Map<String, Object>) map);
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

    private void applySupabaseUser(User user, Map<String, Object> userMap) {
        String supabaseUserId = Optional.ofNullable(userMap.get("id")).map(Object::toString).orElse(null);
        user.setSupabaseUserId(supabaseUserId);

        String email = Optional.ofNullable(userMap.get("email")).map(Object::toString).orElse(null);
        if (email == null || email.isBlank()) {
            email = "supabase-" + supabaseUserId + "@prepaidly.local";
        }
        user.setEmail(email);

        user.setSupabasePhone(Optional.ofNullable(userMap.get("phone")).map(Object::toString).orElse(null));
        user.setSupabaseCreatedAt(parseOffsetDate(userMap.get("created_at")));
        user.setSupabaseUpdatedAt(parseOffsetDate(userMap.get("updated_at")));
        user.setSupabaseLastSignInAt(parseOffsetDate(userMap.get("last_sign_in_at")));
        user.setSupabaseEmailConfirmedAt(parseOffsetDate(userMap.get("email_confirmed_at")));
        user.setSupabasePhoneConfirmedAt(parseOffsetDate(userMap.get("phone_confirmed_at")));

        try {
            user.setSupabaseRawJson(objectMapper.writeValueAsString(userMap));
        } catch (Exception e) {
            log.warn("Failed to serialize Supabase user payload for {}", supabaseUserId, e);
        }
        user.setSupabaseSyncedAt(OffsetDateTime.now());
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
