-- Migration to make reference_number required
-- Step 1: Update any existing records that have NULL reference_number
UPDATE public.schedules 
SET reference_number = 'REF-' || EXTRACT(YEAR FROM created_at) || '-' || LPAD(EXTRACT(DOY FROM created_at)::text, 3, '0') || '-' || SUBSTRING(id::text, 1, 8)
WHERE reference_number IS NULL OR reference_number = '';

-- Step 2: Make the column NOT NULL
ALTER TABLE public.schedules ALTER COLUMN reference_number SET NOT NULL;

-- Verify the migration
SELECT COUNT(*) as total_schedules, 
       COUNT(reference_number) as schedules_with_reference 
FROM public.schedules; 