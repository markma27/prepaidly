-- Migration: Add token lifecycle columns to xero_connections
-- Supports robust Xero token refresh, rotation, and disconnect tracking

-- Connection status: CONNECTED or DISCONNECTED
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) NOT NULL DEFAULT 'CONNECTED';

-- Reason for disconnection (e.g. 'invalid_grant', 'refresh_token_expired', 'user_revoked')
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS disconnect_reason VARCHAR(500);

-- OAuth scopes granted during authorization
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS scopes TEXT;

-- Xero-side connection UUID (from /connections endpoint)
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS xero_connection_id VARCHAR(255);

-- When tokens were last successfully refreshed
ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMP;

-- Index on connection_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_xero_connections_status ON xero_connections(connection_status);

-- Set existing connections to CONNECTED by default (they were already saved)
UPDATE xero_connections SET connection_status = 'CONNECTED' WHERE connection_status IS NULL;
