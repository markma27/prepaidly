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
            log.error("Encryption password is null or empty. Please set JASYPT_ENCRYPTOR_PASSWORD environment variable.");
            throw new IllegalArgumentException("Encryption password cannot be null or empty. Please set JASYPT_ENCRYPTOR_PASSWORD environment variable.");
        }
        
        log.info("Initializing EncryptionService with password length: {}", encryptionPassword.length());
        
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
        
        log.info("EncryptionService initialized successfully");
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
            log.error("Failed to decrypt text - EncryptionOperationNotPossibleException. This usually means:");
            log.error("1. The encryption password (JASYPT_ENCRYPTOR_PASSWORD) is incorrect");
            log.error("2. The encrypted text was encrypted with a different password");
            log.error("3. The encrypted text is corrupted or not properly encrypted");
            log.error("Encrypted text length: {}", encryptedText != null ? encryptedText.length() : 0);
            log.error("Encrypted text preview: {}", encryptedText != null && encryptedText.length() > 20 
                ? encryptedText.substring(0, 20) + "..." : encryptedText);
            throw new RuntimeException("Failed to decrypt: The encryption password (JASYPT_ENCRYPTOR_PASSWORD) may be incorrect or the data was encrypted with a different password. " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Failed to decrypt text - Unexpected error", e);
            throw new RuntimeException("Failed to decrypt: " + e.getMessage(), e);
        }
    }
}

