-- Migration: Add posted_at column to journal_entries table
-- This column stores the timestamp when a journal entry was posted to Xero

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP;

COMMENT ON COLUMN journal_entries.posted_at IS 'Timestamp when the journal entry was posted to Xero';
