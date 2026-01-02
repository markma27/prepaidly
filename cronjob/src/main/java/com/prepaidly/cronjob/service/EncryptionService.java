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
        
        // Trim whitespace (Spring @Value might do this automatically)
        String trimmedPassword = encryptionPassword.trim();
        
        log.info("Initializing EncryptionService with password length: {} (after trim: {})", 
            encryptionPassword.length(), trimmedPassword.length());
        
        // Log first/last few characters for debugging (without exposing full password)
        if (trimmedPassword.length() > 4) {
            log.info("Password starts with: '{}...{}' (first 2 and last 2 chars)", 
                trimmedPassword.substring(0, 2), 
                trimmedPassword.substring(trimmedPassword.length() - 2));
        }
        
        PooledPBEStringEncryptor pooledEncryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        config.setPassword(trimmedPassword);
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
            log.error("=== DECRYPTION FAILED ===");
            log.error("Failed to decrypt text - EncryptionOperationNotPossibleException");
            log.error("This usually means:");
            log.error("1. The encryption password (JASYPT_PASSWORD) is incorrect or different from backend");
            log.error("2. The encrypted text was encrypted with a different password");
            log.error("3. The encrypted text is corrupted or not properly encrypted");
            log.error("4. There may be whitespace/encoding differences in the password");
            log.error("");
            log.error("Encrypted text details:");
            log.error("  - Length: {}", encryptedText != null ? encryptedText.length() : 0);
            log.error("  - Preview (first 30 chars): {}", encryptedText != null && encryptedText.length() > 30 
                ? encryptedText.substring(0, 30) + "..." : encryptedText);
            log.error("  - Preview (last 30 chars): {}", encryptedText != null && encryptedText.length() > 30 
                ? "..." + encryptedText.substring(encryptedText.length() - 30) : encryptedText);
            log.error("");
            log.error("TROUBLESHOOTING:");
            log.error("1. Verify JASYPT_PASSWORD in Railway cronjob matches backend EXACTLY");
            log.error("2. Check for any whitespace before/after the password");
            log.error("3. Ensure the password hasn't been changed since tokens were encrypted");
            log.error("4. Try copying the password again from backend Railway service");
            log.error("5. If tokens were encrypted with old password, reconnect to Xero in backend to regenerate tokens");
            throw new RuntimeException("Failed to decrypt: The encryption password (JASYPT_PASSWORD) may be incorrect or the data was encrypted with a different password. " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Failed to decrypt text - Unexpected error", e);
            throw new RuntimeException("Failed to decrypt: " + e.getMessage(), e);
        }
    }
}

