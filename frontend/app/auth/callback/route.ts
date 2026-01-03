import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const errorCode = requestUrl.searchParams.get('error_code')
  const type = requestUrl.searchParams.get('type') // 'recovery' for password reset

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables are not configured')
    const loginUrl = new URL('/auth/login', requestUrl.origin)
    loginUrl.searchParams.set('error', 'configuration_error')
    loginUrl.searchParams.set('error_description', 'Supabase is not properly configured')
    return NextResponse.redirect(loginUrl.toString())
  }

  // Handle errors from Supabase Auth
  if (error) {
    console.error('Supabase Auth error:', { error, errorCode, errorDescription, type })
    
    // For expired OTP, redirect to password reset page with helpful message
    if (errorCode === 'otp_expired' && type === 'recovery') {
      const resetUrl = new URL('/auth/reset-password', requestUrl.origin)
      resetUrl.searchParams.set('error', 'link_expired')
      resetUrl.searchParams.set('message', 'The password reset link has expired. Please request a new one.')
      return NextResponse.redirect(resetUrl.toString())
    }
    
    // Redirect to login page with error message
    const loginUrl = new URL('/auth/login', requestUrl.origin)
    loginUrl.searchParams.set('error', error)
    if (errorDescription) {
      loginUrl.searchParams.set('error_description', errorDescription)
    }
    if (errorCode) {
      loginUrl.searchParams.set('error_code', errorCode)
    }
    
    return NextResponse.redirect(loginUrl.toString())
  }

  // Handle successful authentication
  if (code) {
    try {
      const cookieStore = await cookies()
      
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
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
                // Ignore errors in server components
              }
            },
          },
        }
      )

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError)
        
        // If it's a recovery flow and the code is expired, redirect to reset password page
        if (type === 'recovery' && exchangeError.message.includes('expired')) {
          const resetUrl = new URL('/auth/reset-password', requestUrl.origin)
          resetUrl.searchParams.set('error', 'link_expired')
          resetUrl.searchParams.set('message', 'The password reset link has expired. Please request a new one.')
          return NextResponse.redirect(resetUrl.toString())
        }
        
        const loginUrl = new URL('/auth/login', requestUrl.origin)
        loginUrl.searchParams.set('error', 'auth_failed')
        loginUrl.searchParams.set('error_description', exchangeError.message)
        return NextResponse.redirect(loginUrl.toString())
      }

      // If it's a password recovery flow, redirect to reset password page
      // The session is already stored by Supabase client
      if (type === 'recovery') {
        // For password reset, we need to pass the code to the reset page
        // The user will be authenticated via the session
        return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
      }

      // Successfully authenticated, redirect to app
      return NextResponse.redirect(new URL('/app', requestUrl.origin))
    } catch (err) {
      console.error('Unexpected error during auth callback:', err)
      const loginUrl = new URL('/auth/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'auth_failed')
      loginUrl.searchParams.set('error_description', 'An unexpected error occurred during authentication')
      return NextResponse.redirect(loginUrl.toString())
    }
  }

  // No code or error, redirect to login
  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}

