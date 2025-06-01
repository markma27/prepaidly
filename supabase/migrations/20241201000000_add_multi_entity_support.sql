-- Migration: Add Multi-Entity Support
-- This migration adds entity management, user roles, and updates existing data structure

-- Create entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    settings JSONB DEFAULT '{}',
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create entity_users table (many-to-many with roles)
CREATE TABLE IF NOT EXISTS entity_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_id, user_id)
);

-- Create entity_invitations table
CREATE TABLE IF NOT EXISTS entity_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add entity_id to existing tables
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE schedule_audit ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Create demo company entity
INSERT INTO entities (id, name, slug, description, is_demo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Company',
    'demo-company',
    'Sample data for testing and demonstration purposes. All users have access to experiment with features.',
    TRUE
);

-- Move existing schedules to demo company
UPDATE schedules SET entity_id = '00000000-0000-0000-0000-000000000001' WHERE entity_id IS NULL;
UPDATE schedule_audit SET entity_id = '00000000-0000-0000-0000-000000000001' WHERE entity_id IS NULL;

-- Make entity_id required after data migration
ALTER TABLE schedules ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE schedule_audit ALTER COLUMN entity_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE schedules ADD CONSTRAINT schedules_entity_id_fkey 
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
ALTER TABLE schedule_audit ADD CONSTRAINT schedule_audit_entity_id_fkey 
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_entity_users_entity_id ON entity_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_users_user_id ON entity_users(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_invitations_email ON entity_invitations(email);
CREATE INDEX IF NOT EXISTS idx_entity_invitations_token ON entity_invitations(token);
CREATE INDEX IF NOT EXISTS idx_schedules_entity_id ON schedules(entity_id);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_entity_id ON schedule_audit(entity_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_entity_users_updated_at BEFORE UPDATE ON entity_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant demo company access to all authenticated users
INSERT INTO entity_users (entity_id, user_id, role)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    auth.users.id,
    'user'
FROM auth.users
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- Update the current user to super_admin (replace with your actual user ID)
-- You'll need to update this with your actual user ID after running the migration
-- UPDATE entity_users SET role = 'super_admin' WHERE user_id = 'YOUR_USER_ID_HERE';

-- Enable RLS on new tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entities
CREATE POLICY "Users can view entities they belong to" ON entities
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = entities.id AND is_active = true
        )
    );

CREATE POLICY "Admins can update their entities" ON entities
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = entities.id 
            AND role IN ('super_admin', 'admin')
            AND is_active = true
        )
    );

CREATE POLICY "Super admins can insert entities" ON entities
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE role = 'super_admin'
            AND is_active = true
        )
    );

-- RLS Policies for entity_users
CREATE POLICY "Users can view entity memberships they belong to" ON entity_users
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() IN (
            SELECT user_id FROM entity_users eu 
            WHERE eu.entity_id = entity_users.entity_id 
            AND eu.role IN ('super_admin', 'admin')
            AND eu.is_active = true
        )
    );

CREATE POLICY "Admins can manage entity users" ON entity_users
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = entity_users.entity_id 
            AND role IN ('super_admin', 'admin')
            AND is_active = true
        )
    );

-- RLS Policies for entity_invitations
CREATE POLICY "Admins can manage invitations" ON entity_invitations
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = entity_invitations.entity_id 
            AND role IN ('super_admin', 'admin')
            AND is_active = true
        )
    );

-- Update existing RLS policies for schedules (entity-based)
DROP POLICY IF EXISTS "Users can only access their own schedules" ON schedules;
CREATE POLICY "Users can access schedules from their entities" ON schedules
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedules.entity_id AND is_active = true
        )
    );

CREATE POLICY "Users can insert schedules in their entities" ON schedules
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedules.entity_id AND is_active = true
        )
    );

CREATE POLICY "Users can update schedules in their entities" ON schedules
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedules.entity_id AND is_active = true
        )
    );

CREATE POLICY "Admins can delete schedules in their entities" ON schedules
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedules.entity_id 
            AND role IN ('super_admin', 'admin')
            AND is_active = true
        )
    );

-- Update RLS policies for schedule_audit (entity-based)
DROP POLICY IF EXISTS "Users can only access their own schedule audit" ON schedule_audit;
CREATE POLICY "Users can view audit for their entities" ON schedule_audit
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedule_audit.entity_id AND is_active = true
        )
    );

CREATE POLICY "Users can insert audit for their entities" ON schedule_audit
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM entity_users 
            WHERE entity_id = schedule_audit.entity_id AND is_active = true
        )
    );

-- Grant necessary permissions
GRANT ALL ON entities TO authenticated;
GRANT ALL ON entity_users TO authenticated;
GRANT ALL ON entity_invitations TO authenticated; 