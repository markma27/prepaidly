-- Add user profile columns for Profile Settings display
-- Display name (from Supabase user_metadata.full_name)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- User role in the system
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'USER';

-- Last login timestamp (synced from Supabase last_sign_in_at)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
