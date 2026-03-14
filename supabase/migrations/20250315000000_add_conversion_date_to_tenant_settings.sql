-- Create tenant_settings if not exists (used by backend for default accounts)
CREATE TABLE IF NOT EXISTS tenant_settings (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    default_prepayment_acct_code VARCHAR(50),
    default_unearned_acct_code VARCHAR(50),
    updated_at TIMESTAMP
);

-- Add conversion_date (lock date - journals on or before this date cannot be posted to Xero)
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS conversion_date DATE;
