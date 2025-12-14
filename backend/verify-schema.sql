-- Verify Prepaidly Schema
-- Run this in Supabase SQL Editor to check if tables have correct structure

-- Check if all required tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('users', 'xero_connections', 'schedules', 'journal_entries', 'logs') 
        THEN '✓ Required'
        ELSE '⚠ Optional/Extra'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check xero_connections table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'xero_connections' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check schedules table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'schedules' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check journal_entries table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'journal_entries' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('users', 'xero_connections', 'schedules', 'journal_entries')
ORDER BY tablename, indexname;

