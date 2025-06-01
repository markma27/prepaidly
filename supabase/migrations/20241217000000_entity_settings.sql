-- Migration to create entity_settings table for entity-specific settings
CREATE TABLE entity_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
  prepaid_accounts JSONB DEFAULT '[
    {"id": "1", "name": "Insurance Prepayments", "account": "1240 - Prepaid Insurance"},
    {"id": "2", "name": "Subscription Prepayments", "account": "1250 - Prepaid Subscriptions"},
    {"id": "3", "name": "Service Prepayments", "account": "1260 - Prepaid Services"}
  ]'::jsonb NOT NULL,
  unearned_accounts JSONB DEFAULT '[
    {"id": "1", "name": "Subscription Income", "account": "2340 - Unearned Subscription Revenue"}
  ]'::jsonb NOT NULL,
  xero_integration JSONB DEFAULT '{
    "enabled": false,
    "tenant_id": null,
    "client_id": null
  }'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add unique constraint on entity_id (one settings record per entity)
ALTER TABLE entity_settings ADD CONSTRAINT entity_settings_entity_id_unique UNIQUE (entity_id);

-- Enable Row Level Security
ALTER TABLE entity_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for entity-based access
CREATE POLICY "Users can view entity settings they have access to" ON entity_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entity_users 
      WHERE entity_users.entity_id = entity_settings.entity_id 
      AND entity_users.user_id = auth.uid()
      AND entity_users.is_active = true
    )
  );

CREATE POLICY "Users can insert entity settings for entities they manage" ON entity_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM entity_users 
      WHERE entity_users.entity_id = entity_settings.entity_id 
      AND entity_users.user_id = auth.uid()
      AND entity_users.is_active = true
      AND entity_users.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can update entity settings for entities they manage" ON entity_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM entity_users 
      WHERE entity_users.entity_id = entity_settings.entity_id 
      AND entity_users.user_id = auth.uid()
      AND entity_users.is_active = true
      AND entity_users.role IN ('super_admin', 'admin')
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_entity_settings_updated_at 
  BEFORE UPDATE ON entity_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default entity settings for all existing entities
INSERT INTO entity_settings (entity_id)
SELECT e.id
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM entity_settings es 
  WHERE es.entity_id = e.id
); 