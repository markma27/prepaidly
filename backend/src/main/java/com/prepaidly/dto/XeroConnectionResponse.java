package com.prepaidly.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class XeroConnectionResponse {
    private String tenantId;
    private String tenantName;
    private Boolean connected;
    private String message;
}

@Data
@AllArgsConstructor
@NoArgsConstructor
public class XeroConnectionStatusResponse {
    private List<XeroConnectionResponse> connections;
    private Integer totalConnections;
}

