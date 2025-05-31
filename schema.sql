-- Database schema for Prepaidly.io
-- Run this in your Supabase SQL editor

create table public.schedules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  type text check (type in ('prepayment','unearned')),
  vendor text not null,
  invoice_date date not null,
  total_amount numeric not null,
  service_start date not null,
  service_end date not null,
  description text,
  reference_number text not null,
  created_at timestamptz default now()
);

create table public.schedule_entries (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid references public.schedules(id) on delete cascade,
  period date not null,
  amount numeric not null,
  cumulative numeric not null,
  remaining numeric not null
);

-- Row Level Security (RLS) policies
alter table public.schedules enable row level security;
alter table public.schedule_entries enable row level security;

-- Policies for schedules table
create policy "Users can only see their own schedules" on public.schedules
  for select using (auth.uid() = user_id);

create policy "Users can only insert their own schedules" on public.schedules
  for insert with check (auth.uid() = user_id);

create policy "Users can only update their own schedules" on public.schedules
  for update using (auth.uid() = user_id);

create policy "Users can only delete their own schedules" on public.schedules
  for delete using (auth.uid() = user_id);

-- Policies for schedule_entries table  
create policy "Users can only see their own schedule entries" on public.schedule_entries
  for select using (
    exists (
      select 1 from public.schedules
      where schedules.id = schedule_entries.schedule_id
      and schedules.user_id = auth.uid()
    )
  );

create policy "Users can only insert their own schedule entries" on public.schedule_entries
  for insert with check (
    exists (
      select 1 from public.schedules
      where schedules.id = schedule_entries.schedule_id
      and schedules.user_id = auth.uid()
    )
  );

create policy "Users can only update their own schedule entries" on public.schedule_entries
  for update using (
    exists (
      select 1 from public.schedules
      where schedules.id = schedule_entries.schedule_id
      and schedules.user_id = auth.uid()
    )
  );

create policy "Users can only delete their own schedule entries" on public.schedule_entries
  for delete using (
    exists (
      select 1 from public.schedules
      where schedules.id = schedule_entries.schedule_id
      and schedules.user_id = auth.uid()
    )
  );

-- Migration to add reference_number column (run this if table already exists)
-- ALTER TABLE public.schedules ADD COLUMN reference_number text; 