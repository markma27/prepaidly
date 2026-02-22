-- Add voided column to schedules table
-- Voided schedules are excluded from Analytics and Schedule Register by default
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
