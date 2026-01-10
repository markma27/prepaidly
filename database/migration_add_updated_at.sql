-- Migration: Add updated_at column to journal_entries table
-- This column automatically tracks when a journal entry is updated (e.g., when posted)

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

COMMENT ON COLUMN journal_entries.updated_at IS 'Timestamp when the journal entry was last updated (automatically maintained)';

-- Set initial value for existing rows
UPDATE journal_entries 
SET updated_at = created_at 
WHERE updated_at IS NULL;
