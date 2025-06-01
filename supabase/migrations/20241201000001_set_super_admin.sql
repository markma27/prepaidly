-- Set Super Admin Role
-- Run this after the main migration to set yourself as super_admin
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users

-- You can find your user ID by running: SELECT id, email FROM auth.users;

-- Update your role to super_admin for Demo Company
UPDATE entity_users 
SET role = 'super_admin' 
WHERE user_id = 'YOUR_USER_ID_HERE' 
AND entity_id = '00000000-0000-0000-0000-000000000001';

-- Insert super_admin role if you're not already in entity_users
INSERT INTO entity_users (entity_id, user_id, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'YOUR_USER_ID_HERE',
    'super_admin'
)
ON CONFLICT (entity_id, user_id) 
DO UPDATE SET role = 'super_admin';

-- Optional: Verify the setup
-- SELECT 
--     u.email,
--     e.name as entity_name,
--     eu.role
-- FROM entity_users eu
-- JOIN auth.users u ON eu.user_id = u.id
-- JOIN entities e ON eu.entity_id = e.id
-- WHERE u.id = 'YOUR_USER_ID_HERE'; 