# Database Setup - User Settings

## New Migration: 003_user_settings.sql

This migration adds the `user_settings` table to store user preferences and configuration.

### Table Structure

- **id**: UUID primary key
- **user_id**: Reference to auth.users, CASCADE delete
- **currency**: 3-character currency code (default: USD)
- **timezone**: Timezone string (default: UTC)
- **prepaid_accounts**: JSONB storing default account mappings for prepaid expenses
- **unearned_accounts**: JSONB storing default account mappings for unearned revenue
- **xero_integration**: JSONB storing Xero integration settings (placeholder for future)
- **created_at/updated_at**: Timestamps with automatic triggers

### Default Values

#### Prepaid Accounts
```json
{
  "insurance": "1240 - Prepaid Insurance",
  "subscription": "1250 - Prepaid Subscriptions", 
  "service": "1260 - Prepaid Services"
}
```

#### Unearned Accounts
```json
{
  "subscription_income": "2340 - Unearned Subscription Revenue"
}
```

#### Xero Integration
```json
{
  "enabled": false,
  "tenant_id": null,
  "client_id": null
}
```

### Security

- Row Level Security (RLS) enabled
- Users can only access their own settings
- Policies for SELECT, INSERT, UPDATE, DELETE operations

### To Apply Migration

If using Supabase CLI:
```bash
supabase db push
```

Or run the SQL directly in your Supabase dashboard SQL editor. 