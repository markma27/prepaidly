package com.prepaidly.repository;

import com.prepaidly.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class UserRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    @Test
    void testSaveUser() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setCreatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);

        assertNotNull(saved.getId());
        assertEquals("test@example.com", saved.getEmail());
        assertNotNull(saved.getCreatedAt());
    }

    @Test
    void testFindByEmail_Success() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setCreatedAt(LocalDateTime.now());
        entityManager.persistAndFlush(user);

        Optional<User> found = userRepository.findByEmail("test@example.com");

        assertTrue(found.isPresent());
        assertEquals("test@example.com", found.get().getEmail());
    }

    @Test
    void testFindByEmail_NotFound() {
        Optional<User> found = userRepository.findByEmail("nonexistent@example.com");
        assertFalse(found.isPresent());
    }

    @Test
    void testFindById_Success() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setCreatedAt(LocalDateTime.now());
        User saved = entityManager.persistAndFlush(user);

        Optional<User> found = userRepository.findById(Objects.requireNonNull(saved.getId(), "Saved user ID cannot be null"));

        assertTrue(found.isPresent());
        assertEquals(saved.getId(), Objects.requireNonNull(found.get().getId(), "Found user ID cannot be null"));
    }

    @Test
    void testDeleteUser() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setCreatedAt(LocalDateTime.now());
        User saved = entityManager.persistAndFlush(user);

        Long savedId = Objects.requireNonNull(saved.getId(), "Saved user ID cannot be null");
        userRepository.deleteById(savedId);

        Optional<User> found = userRepository.findById(savedId);
        assertFalse(found.isPresent());
    }
}

