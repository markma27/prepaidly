package com.prepaidly.cronjob.service;

import org.jasypt.encryption.StringEncryptor;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for encrypting and decrypting sensitive strings (Xero tokens).
 * Uses Jasypt for encryption/decryption.
 */
public class EncryptionService {
    private static final Logger log = LoggerFactory.getLogger(EncryptionService.class);
    private final StringEncryptor encryptor;
    
    public EncryptionService(String encryptionPassword) {
        if (encryptionPassword == null || encryptionPassword.isEmpty()) {
            log.error("Encryption password is null or empty. Please set JASYPT_PASSWORD environment variable.");
            throw new IllegalArgumentException("Encryption password cannot be null or empty. Please set JASYPT_PASSWORD environment variable.");
        }
        
        // IMPORTANT: Do NOT trim - Spring @Value doesn't trim, so we must match exactly
        // Any whitespace in the password must be preserved to match backend behavior
        log.info("Initializing EncryptionService with password length: {}", encryptionPassword.length());
        
        // Log first/last few characters for debugging (without exposing full password)
        if (encryptionPassword.length() > 4) {
            log.info("Password preview: '{}...{}' (first 2 and last 2 chars)", 
                encryptionPassword.substring(0, 2), 
                encryptionPassword.substring(encryptionPassword.length() - 2));
        }
        
        // Check for leading/trailing whitespace (for debugging)
        if (!encryptionPassword.equals(encryptionPassword.trim())) {
            log.warn("Password has leading/trailing whitespace - this will be preserved to match backend");
        }
        
        PooledPBEStringEncryptor pooledEncryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        config.setPassword(encryptionPassword);
        config.setAlgorithm("PBEWithMD5AndDES");
        config.setKeyObtentionIterations(1000);
        config.setPoolSize(1);
        config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        config.setStringOutputType("base64");
        pooledEncryptor.setConfig(config);
        this.encryptor = pooledEncryptor;
        
        // Test encryption/decryption to verify password works
        try {
            String testString = "test-encryption-verification";
            String encrypted = encryptor.encrypt(testString);
            String decrypted = encryptor.decrypt(encrypted);
            if (!testString.equals(decrypted)) {
                log.error("Encryption test failed - decrypted value doesn't match!");
                throw new RuntimeException("Encryption service test failed");
            }
            log.info("EncryptionService initialized successfully - encryption/decryption test passed");
        } catch (Exception e) {
            log.error("EncryptionService initialization test failed", e);
            throw new RuntimeException("Encryption service initialization failed: " + e.getMessage(), e);
        }
    }
    
    public String encrypt(String plainText) {
        if (plainText == null) {
            return null;
        }
        return encryptor.encrypt(plainText);
    }
    
    public String decrypt(String encryptedText) {
        if (encryptedText == null) {
            return null;
        }
        try {
            log.debug("Attempting to decrypt text (length: {})", encryptedText != null ? encryptedText.length() : 0);
            String decrypted = encryptor.decrypt(encryptedText);
            log.debug("Successfully decrypted text");
            return decrypted;
        } catch (org.jasypt.exceptions.EncryptionOperationNotPossibleException e) {
            throw new RuntimeException(e.getMessage(), e);
        } catch (Exception e) {
            log.error("Failed to decrypt text - Unexpected error", e);
            throw new RuntimeException("Failed to decrypt: " + e.getMessage(), e);
        }
    }
}

