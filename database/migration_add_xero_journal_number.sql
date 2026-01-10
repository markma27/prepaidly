-- Migration: Add xero_journal_number column to journal_entries table
-- This column stores the journal number assigned by Xero when a journal entry is posted

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS xero_journal_number INTEGER;

COMMENT ON COLUMN journal_entries.xero_journal_number IS 'Xero journal number assigned when posted to Xero';
