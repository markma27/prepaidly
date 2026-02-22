-- Add Supabase user UUID mapping to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS supabase_user_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users(supabase_user_id);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS supabase_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS supabase_synced_at TIMESTAMPTZ;
