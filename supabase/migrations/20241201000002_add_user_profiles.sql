-- Migration: Add User Profiles with Extended Information
-- This migration adds user profiles, 2FA preparation, and Xero integration support

-- Create profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    
    -- 2FA fields (for future implementation)
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[], -- Array of backup codes
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Xero integration fields (for future implementation)
    xero_user_id TEXT,
    xero_tenant_id TEXT,
    xero_tenant_name TEXT,
    xero_access_token_encrypted TEXT, -- Will store encrypted token
    xero_refresh_token_encrypted TEXT, -- Will store encrypted refresh token
    xero_token_expires_at TIMESTAMP WITH TIME ZONE,
    xero_connected_at TIMESTAMP WITH TIME ZONE,
    
    -- Preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles for existing users
INSERT INTO profiles (id, first_name, last_name)
SELECT 
    id,
    SPLIT_PART(COALESCE(raw_user_meta_data->>'full_name', email), ' ', 1) as first_name,
    CASE 
        WHEN SPLIT_PART(COALESCE(raw_user_meta_data->>'full_name', email), ' ', 2) != '' 
        THEN SPLIT_PART(COALESCE(raw_user_meta_data->>'full_name', email), ' ', 2)
        ELSE NULL
    END as last_name
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (
        NEW.id,
        SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1),
        CASE 
            WHEN SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 2) != '' 
            THEN SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 2)
            ELSE NULL
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_xero_user_id ON profiles(xero_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_xero_tenant_id ON profiles(xero_tenant_id);

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can view profiles of users in their entities
CREATE POLICY "Admins can view entity user profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM entity_users eu1
            JOIN entity_users eu2 ON eu1.entity_id = eu2.entity_id
            WHERE eu1.user_id = auth.uid()
            AND eu2.user_id = profiles.id
            AND eu1.role IN ('super_admin', 'admin')
            AND eu1.is_active = true
            AND eu2.is_active = true
        )
    );

-- Create helper function to get user display name
CREATE OR REPLACE FUNCTION get_user_display_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    display_name TEXT;
BEGIN
    SELECT 
        CASE 
            WHEN p.first_name IS NOT NULL AND p.last_name IS NOT NULL 
            THEN p.first_name || ' ' || p.last_name
            WHEN p.first_name IS NOT NULL 
            THEN p.first_name
            ELSE SPLIT_PART(u.email, '@', 1)
        END
    INTO display_name
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = user_id;
    
    RETURN COALESCE(display_name, 'Unknown User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update audit logger to include better user names
-- First, let's add a user_display_name column to schedule_audit for better tracking
ALTER TABLE schedule_audit ADD COLUMN IF NOT EXISTS user_display_name TEXT;

-- Create function to update audit entries with display names
CREATE OR REPLACE FUNCTION update_audit_user_names()
RETURNS VOID AS $$
BEGIN
    UPDATE schedule_audit 
    SET user_display_name = get_user_display_name(user_id)
    WHERE user_display_name IS NULL AND user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Run the update for existing audit entries
SELECT update_audit_user_names();

-- Grant permissions
GRANT ALL ON profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_display_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_audit_user_names() TO authenticated; 