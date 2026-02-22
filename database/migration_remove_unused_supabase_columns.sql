-- Remove unused Supabase columns from users
ALTER TABLE users
DROP COLUMN IF EXISTS supabase_phone,
DROP COLUMN IF EXISTS supabase_updated_at,
DROP COLUMN IF EXISTS supabase_last_sign_in_at,
DROP COLUMN IF EXISTS supabase_email_confirmed_at,
DROP COLUMN IF EXISTS supabase_phone_confirmed_at,
DROP COLUMN IF EXISTS supabase_raw_json;
