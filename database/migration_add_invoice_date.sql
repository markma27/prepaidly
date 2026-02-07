-- Add invoice_date to schedules table (optional date on the related invoice)
-- Run this in Supabase SQL Editor or your PostgreSQL client.

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS invoice_date DATE;

COMMENT ON COLUMN schedules.invoice_date IS 'Optional date on the related invoice';
