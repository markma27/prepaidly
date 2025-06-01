-- Add audit trail table for schedules
CREATE TABLE IF NOT EXISTS public.schedule_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'generated', 'downloaded')),
  details TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_schedule_audit_schedule_id ON public.schedule_audit(schedule_id);
CREATE INDEX idx_schedule_audit_created_at ON public.schedule_audit(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.schedule_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see audit entries for their own schedules
CREATE POLICY "Users can view own schedule audit entries" ON public.schedule_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_audit.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own schedule audit entries" ON public.schedule_audit
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_audit.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.schedule_audit IS 'Audit trail for schedule changes and actions';
COMMENT ON COLUMN public.schedule_audit.action IS 'Human readable action description';
COMMENT ON COLUMN public.schedule_audit.action_type IS 'Categorized action type for filtering and UI';
COMMENT ON COLUMN public.schedule_audit.details IS 'Detailed description of what changed';
COMMENT ON COLUMN public.schedule_audit.old_values IS 'Previous values (for updates)';
COMMENT ON COLUMN public.schedule_audit.new_values IS 'New values (for updates)'; 