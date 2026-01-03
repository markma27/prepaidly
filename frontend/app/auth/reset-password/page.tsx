'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [linkExpired, setLinkExpired] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')

    if (errorParam === 'link_expired' || messageParam?.includes('expired')) {
      setLinkExpired(true)
      setError(messageParam || 'The password reset link has expired. Please request a new one.')
      return
    }

    // Check for token in URL hash (password reset links may use hash fragment)
    const hash = window.location.hash.substring(1)
    if (hash) {
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (type === 'recovery' && accessToken && refreshToken) {
        // Set session from hash fragment tokens
        initializeSessionFromHash(accessToken, refreshToken)
        return
      }
    }

    // Check if user has a valid session (from password reset callback)
    checkSession()
  }, [searchParams])

  const initializeSessionFromHash = async (accessToken: string, refreshToken: string) => {
    try {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (sessionError) {
        console.error('Error setting session from hash:', sessionError)
        setError('Failed to initialize session: ' + sessionError.message)
        return
      }

      if (data.session) {
        setCode('valid')
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname)
      } else {
        setLinkExpired(true)
        setError('No valid session found. The password reset link may have expired.')
      }
    } catch (err: any) {
      console.error('Error initializing session from hash:', err)
      setError('Failed to initialize session. Please request a new password reset.')
    }
  }

  const checkSession = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        // If it's a PKCE error, the session might be in the URL hash
        if (sessionError.message.includes('PKCE') || sessionError.message.includes('code verifier')) {
          // Check URL hash for tokens
          const hash = window.location.hash.substring(1)
          if (hash) {
            const hashParams = new URLSearchParams(hash)
            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')
            if (accessToken && refreshToken) {
              await initializeSessionFromHash(accessToken, refreshToken)
              return
            }
          }
        }
        setError('Session error: ' + sessionError.message)
        return
      }

      if (!session) {
        setLinkExpired(true)
        setError('No valid session found. The password reset link may have expired. Please request a new one.')
        return
      }

      // User has a valid session, can proceed with password reset
      setCode('valid') // Set a flag to indicate session is valid
    } catch (err: any) {
      console.error('Error checking session:', err)
      setError('Failed to verify session. Please request a new password reset.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (code !== 'valid') {
      setError('Invalid reset session. Please request a new password reset.')
      return
    }

    setLoading(true)

    try {
      // Update password using the current session
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
          setLinkExpired(true)
          setError('The password reset link has expired or is invalid. Please request a new one.')
        } else {
          setError(updateError.message || 'Failed to reset password')
        }
        return
      }

      setSuccess(true)
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login?message=password_reset_success')
      }, 2000)
    } catch (err: any) {
      console.error('Error resetting password:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestNewLink = () => {
    router.push('/auth/forgot-password')
  }

  if (linkExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="flex justify-center mb-2 scale-110">
            <Link href="/" className="relative w-64 h-24 hover:opacity-90 transition-all active:scale-[0.98]">
              <Image
                src="/Logo.svg"
                alt="Logo"
                fill
                className="object-contain"
                priority
              />
            </Link>
          </div>

          <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
            <div className="bg-gradient-to-r from-red-50 via-red-100 to-red-50 py-4 flex items-center justify-center border-b border-red-100">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Link Expired</h2>
            </div>
            <CardContent className="p-8">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  The password reset link has expired. Password reset links are valid for a limited time for security reasons.
                </p>
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                    {error}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={handleRequestNewLink}
                    className="flex-1 h-11 bg-[#6d69ff] text-white hover:bg-[#5a56e6] active:bg-[#4a46cc] active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-[#6d69ff]/10"
                  >
                    Request New Link
                  </Button>
                  <Button
                    onClick={() => router.push('/auth/login')}
                    variant="outline"
                    className="flex-1 h-11"
                  >
                    Back to Login
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="flex justify-center mb-2 scale-110">
            <Link href="/" className="relative w-64 h-24 hover:opacity-90 transition-all active:scale-[0.98]">
              <Image
                src="/Logo.svg"
                alt="Logo"
                fill
                className="object-contain"
                priority
              />
            </Link>
          </div>

          <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
            <div className="bg-gradient-to-r from-green-50 via-green-100 to-green-50 py-4 flex items-center justify-center border-b border-green-100">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Password Reset Successful</h2>
            </div>
            <CardContent className="p-8">
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  Your password has been successfully reset. You will be redirected to the login page shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex justify-center mb-2 scale-110">
          <Link href="/" className="relative w-64 h-24 hover:opacity-90 transition-all active:scale-[0.98]">
            <Image
              src="/Logo.svg"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/35 to-[#6d69ff]/10 py-4 flex items-center justify-center border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Reset Password</h2>
          </div>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-brand/5 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-brand/5 transition-all"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full h-11 bg-[#6d69ff] text-white hover:bg-[#5a56e6] active:bg-[#4a46cc] active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-[#6d69ff]/10 mt-2" 
                disabled={loading || !code}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting password...
                  </>
                ) : 'Reset Password'}
              </Button>
            </form>
            <div className="mt-8 text-center text-xs border-t border-slate-100 pt-6">
              <Link href="/auth/login" className="text-slate-900 hover:underline font-bold">
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="flex justify-center mb-2 scale-110">
            <Link href="/" className="relative w-64 h-24 hover:opacity-90 transition-all active:scale-[0.98]">
              <Image
                src="/Logo.svg"
                alt="Logo"
                fill
                className="object-contain"
                priority
              />
            </Link>
          </div>
          <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#6d69ff]" />
                <p className="text-sm text-gray-600">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

