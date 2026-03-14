-- Add Xero user ID to users table for Xero-only login
ALTER TABLE users
ADD COLUMN IF NOT EXISTS xero_user_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_xero_user_id ON users(xero_user_id);
