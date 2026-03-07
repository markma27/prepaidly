-- Add write-off flag to journal_entries for "Fully Recognise" feature
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS is_write_off boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN journal_entries.is_write_off IS 'True when this entry is a full recognition (write-off) of remaining balance, not a regular period entry.';
