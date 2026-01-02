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
            throw new IllegalArgumentException("Encryption password cannot be null or empty");
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
        
        log.info("EncryptionService initialized");
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
            return encryptor.decrypt(encryptedText);
        } catch (Exception e) {
            log.error("Failed to decrypt text", e);
            throw new RuntimeException("Failed to decrypt: " + e.getMessage(), e);
        }
    }
}

