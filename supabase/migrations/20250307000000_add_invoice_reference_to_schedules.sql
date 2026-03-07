-- Add invoice_reference column to schedules (required on frontend, nullable for existing rows)
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS invoice_reference character varying;

COMMENT ON COLUMN public.schedules.invoice_reference IS 'Invoice reference or number for the schedule';
