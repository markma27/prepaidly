package com.prepaidly.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class XeroInvoiceResponse {
    private List<Invoice> invoices;
    
    @Data
    public static class Invoice {
        private String invoiceID;
        private String invoiceNumber;
        private String type;
        private LocalDate date;
        private LocalDate dueDate;
        private BigDecimal total;
        private BigDecimal totalTax;
        private BigDecimal amountDue;
        private String status;
        private String contactName;
        private String contactID;
    }
}

