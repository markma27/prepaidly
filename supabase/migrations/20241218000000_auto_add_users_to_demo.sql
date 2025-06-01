-- Migration: Auto-add new users to Demo Company
-- This migration updates the handle_new_user function to automatically add new users to the Demo Company

-- Update the handle_new_user function to also add users to Demo Company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user profile
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
    
    -- Add user to Demo Company with 'user' role
    INSERT INTO public.entity_users (entity_id, user_id, role, is_active)
    VALUES (
        '00000000-0000-0000-0000-000000000001', -- Demo Company ID
        NEW.id,
        'user',
        true
    )
    ON CONFLICT (entity_id, user_id) DO NOTHING; -- Prevent duplicates if somehow already exists
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 