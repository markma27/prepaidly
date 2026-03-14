-- Add is_org_admin to xero_connections: true for the first user who connected each organisation
ALTER TABLE xero_connections
ADD COLUMN IF NOT EXISTS is_org_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN xero_connections.is_org_admin IS 'True for the first user who connected this Xero organisation; they can invite users and promote to admin';

-- Set is_org_admin=true for the earliest connection per tenant (existing data)
WITH first_per_tenant AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM xero_connections
  ORDER BY tenant_id, created_at ASC
)
UPDATE xero_connections
SET is_org_admin = true
WHERE id IN (SELECT id FROM first_per_tenant);

-- Ensure super admin emails have SYS_ADMIN role (only these two can be super admin)
UPDATE users
SET role = 'SYS_ADMIN'::user_role
WHERE LOWER(email) IN ('mayinxing@gmail.com', 'edmond.huo@prepaidly.io');
