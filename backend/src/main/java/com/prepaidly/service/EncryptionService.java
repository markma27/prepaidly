package com.prepaidly.service;

import org.jasypt.encryption.StringEncryptor;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EncryptionService {
    
    private final StringEncryptor encryptor;
    
    public EncryptionService(@Value("${jasypt.encryptor.password}") String encryptionPassword) {
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
        return encryptor.decrypt(encryptedText);
    }
}

