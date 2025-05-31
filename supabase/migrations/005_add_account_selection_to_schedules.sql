-- Add account selection to schedules table
-- This allows users to select which account from their settings to use for each schedule

ALTER TABLE schedules 
ADD COLUMN account_id VARCHAR(50);

-- Add a comment to explain the column
COMMENT ON COLUMN schedules.account_id IS 'References the ID of the account from user_settings prepaid_accounts or unearned_accounts arrays';

-- Note: We're not using a foreign key constraint because the account_id references 
-- an ID within a JSONB array in user_settings, which PostgreSQL can't enforce with FK constraints 