import { createBrowserClient, createServerClient } from '@supabase/ssr'

// Get environment variables with fallbacks for build time
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url && typeof window !== 'undefined') {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
  }
  return url || 'https://placeholder.supabase.co'
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key && typeof window !== 'undefined') {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return key || 'placeholder-key'
}

// Client-side Supabase client
export const createClient = () => {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  )
}

// Server-side Supabase client
export const createServerSupabaseClient = async () => {
  // Only validate on server during actual runtime, not build
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
} 