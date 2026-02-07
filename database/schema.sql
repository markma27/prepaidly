-- Database Schema for Prepaidly
-- PostgreSQL 14+

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Xero Connections table
-- Stores OAuth tokens and connection lifecycle state per user+tenant
CREATE TABLE IF NOT EXISTS xero_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    tenant_name VARCHAR(255),                        -- Stored for display when tokens expire
    access_token TEXT NOT NULL,                       -- Encrypted (expires after 30 min)
    refresh_token TEXT NOT NULL,                      -- Encrypted (rotated on each refresh, expires after 60 days inactivity)
    expires_at TIMESTAMP NOT NULL,                    -- When access_token expires
    connection_status VARCHAR(20) NOT NULL DEFAULT 'CONNECTED',  -- CONNECTED or DISCONNECTED
    disconnect_reason VARCHAR(500),                   -- Why disconnected (e.g. invalid_grant, refresh_token_expired)
    scopes TEXT,                                      -- OAuth scopes granted (space-separated)
    xero_connection_id VARCHAR(255),                  -- Xero-side connection UUID from /connections
    last_refreshed_at TIMESTAMP,                      -- When tokens were last successfully refreshed
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_xero_connections_user_id ON xero_connections(user_id);
CREATE INDEX idx_xero_connections_tenant_id ON xero_connections(tenant_id);
CREATE INDEX idx_xero_connections_status ON xero_connections(connection_status);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    xero_invoice_id VARCHAR(255),
    type VARCHAR(20) NOT NULL CHECK (type IN ('prepaid', 'unearned')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount DECIMAL(19, 2) NOT NULL,
    expense_acct_code VARCHAR(50),
    revenue_acct_code VARCHAR(50),
    deferral_acct_code VARCHAR(50) NOT NULL,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_tenant_id ON schedules(tenant_id);
CREATE INDEX idx_schedules_type ON schedules(type);

-- Journal Entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    amount DECIMAL(19, 2) NOT NULL,
    xero_manual_journal_id VARCHAR(255),
    posted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_entries_schedule_id ON journal_entries(schedule_id);
CREATE INDEX idx_journal_entries_period_date ON journal_entries(period_date);
CREATE INDEX idx_journal_entries_posted ON journal_entries(posted);

-- Logs table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    event VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_event ON logs(event);
CREATE INDEX idx_logs_created_at ON logs(created_at);

