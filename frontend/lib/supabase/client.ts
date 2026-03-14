/**
 * @deprecated Supabase Auth has been replaced by Xero-only login.
 * This client is still used for Supabase Storage (invoice file uploads).
 * Do not use for authentication - use lib/auth.ts instead.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
