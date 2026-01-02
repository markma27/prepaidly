package com.prepaidly.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EncryptionServiceTest {

    private EncryptionService encryptionService;

    @BeforeEach
    void setUp() {
        encryptionService = new EncryptionService("test-encryption-password-12345");
    }

    @Test
    void testEncryptAndDecrypt_Success() {
        String plainText = "test-secret-value";
        
        String encrypted = encryptionService.encrypt(plainText);
        assertNotNull(encrypted);
        assertNotEquals(plainText, encrypted);
        
        String decrypted = encryptionService.decrypt(encrypted);
        assertEquals(plainText, decrypted);
    }

    @Test
    void testEncrypt_NullInput() {
        String result = encryptionService.encrypt(null);
        assertNull(result);
    }

    @Test
    void testDecrypt_NullInput() {
        String result = encryptionService.decrypt(null);
        assertNull(result);
    }

    @Test
    void testEncrypt_EmptyString() {
        String encrypted = encryptionService.encrypt("");
        assertNotNull(encrypted);
        
        String decrypted = encryptionService.decrypt(encrypted);
        assertEquals("", decrypted);
    }

    @Test
    void testEncrypt_SpecialCharacters() {
        String plainText = "test@example.com!123#$%";
        
        String encrypted = encryptionService.encrypt(plainText);
        String decrypted = encryptionService.decrypt(encrypted);
        
        assertEquals(plainText, decrypted);
    }

    @Test
    void testEncrypt_LongString() {
        String plainText = "a".repeat(1000);
        
        String encrypted = encryptionService.encrypt(plainText);
        String decrypted = encryptionService.decrypt(encrypted);
        
        assertEquals(plainText, decrypted);
    }
}

