package com.prepaidly.dto;

import lombok.Data;

import java.util.List;

@Data
public class XeroAccountResponse {
    private List<Account> accounts;
    
    @Data
    public static class Account {
        private String accountID;
        private String code;
        private String name;
        private String type;
        private String status;
        private Boolean isSystemAccount;
    }
}

