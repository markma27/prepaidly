-- Migration to convert account structure from objects to arrays
-- This converts existing data from the old format to the new format

-- Update prepaid_accounts from object to array format
UPDATE user_settings 
SET prepaid_accounts = jsonb_build_array(
  jsonb_build_object('id', '1', 'name', 'Insurance Prepayments', 'account', prepaid_accounts->>'insurance'),
  jsonb_build_object('id', '2', 'name', 'Subscription Prepayments', 'account', prepaid_accounts->>'subscription'),
  jsonb_build_object('id', '3', 'name', 'Service Prepayments', 'account', prepaid_accounts->>'service')
)
WHERE jsonb_typeof(prepaid_accounts) = 'object' 
AND prepaid_accounts ? 'insurance';

-- Update unearned_accounts from object to array format  
UPDATE user_settings
SET unearned_accounts = jsonb_build_array(
  jsonb_build_object('id', '1', 'name', 'Subscription Income', 'account', unearned_accounts->>'subscription_income')
)
WHERE jsonb_typeof(unearned_accounts) = 'object'
AND unearned_accounts ? 'subscription_income';

-- Update default values for new records
ALTER TABLE user_settings 
ALTER COLUMN prepaid_accounts SET DEFAULT '[
  {"id": "1", "name": "Insurance Prepayments", "account": "1240 - Prepaid Insurance"},
  {"id": "2", "name": "Subscription Prepayments", "account": "1250 - Prepaid Subscriptions"}, 
  {"id": "3", "name": "Service Prepayments", "account": "1260 - Prepaid Services"}
]'::jsonb;

ALTER TABLE user_settings
ALTER COLUMN unearned_accounts SET DEFAULT '[
  {"id": "1", "name": "Subscription Income", "account": "2340 - Unearned Subscription Revenue"}
]'::jsonb; 