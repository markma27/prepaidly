package com.prepaidly.cronjob.util;

import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Diagnostic utility to help troubleshoot encryption password issues.
 * Can be used to test if a password can decrypt sample encrypted text.
 */
public class PasswordDiagnostic {
    private static final Logger log = LoggerFactory.getLogger(PasswordDiagnostic.class);
    
    /**
     * Test if a password can decrypt a given encrypted string.
     * This helps verify if the password is correct.
     */
    public static boolean testPassword(String password, String encryptedText) {
        try {
            PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
            SimpleStringPBEConfig config = new SimpleStringPBEConfig();
            config.setPassword(password.trim());
            config.setAlgorithm("PBEWithMD5AndDES");
            config.setKeyObtentionIterations(1000);
            config.setPoolSize(1);
            config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
            config.setStringOutputType("base64");
            encryptor.setConfig(config);
            
            String decrypted = encryptor.decrypt(encryptedText);
            log.info("Password test SUCCESS - decryption worked!");
            return true;
        } catch (Exception e) {
            log.error("Password test FAILED - {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Test encryption/decryption with a password to verify the service works.
     */
    public static boolean testEncryptionService(String password) {
        try {
            PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
            SimpleStringPBEConfig config = new SimpleStringPBEConfig();
            config.setPassword(password.trim());
            config.setAlgorithm("PBEWithMD5AndDES");
            config.setKeyObtentionIterations(1000);
            config.setPoolSize(1);
            config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
            config.setStringOutputType("base64");
            encryptor.setConfig(config);
            
            String testString = "test-encryption-" + System.currentTimeMillis();
            String encrypted = encryptor.encrypt(testString);
            String decrypted = encryptor.decrypt(encrypted);
            
            if (testString.equals(decrypted)) {
                log.info("Encryption service test PASSED");
                return true;
            } else {
                log.error("Encryption service test FAILED - decrypted value doesn't match");
                return false;
            }
        } catch (Exception e) {
            log.error("Encryption service test FAILED - {}", e.getMessage(), e);
            return false;
        }
    }
}

