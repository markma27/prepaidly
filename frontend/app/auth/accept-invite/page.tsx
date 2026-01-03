'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function AcceptInvitePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    // Extract token from URL hash fragment
    const hash = window.location.hash.substring(1) // Remove the '#'
    const params = new URLSearchParams(hash)
    
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const tokenType = params.get('token_type')
    const type = params.get('type')

    // Check if this is an invite
    if (type !== 'invite') {
      setError('Invalid invitation link. This link is not for accepting an invitation.')
      setInitializing(false)
      return
    }

    if (!accessToken || !refreshToken) {
      setError('Invalid invitation link. Missing authentication tokens.')
      setInitializing(false)
      return
    }

    // Set the session using the tokens from the URL
    initializeSession(accessToken, refreshToken)
  }, [])

  const initializeSession = async (accessToken: string, refreshToken: string) => {
    try {
      // Set the session using Supabase
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (sessionError) {
        console.error('Error setting session:', sessionError)
        setError('Failed to initialize session: ' + sessionError.message)
        setInitializing(false)
        return
      }

      if (data.user) {
        setEmail(data.user.email || null)
        setInitializing(false)
      } else {
        setError('No user data found in session')
        setInitializing(false)
      }
    } catch (err: any) {
      console.error('Error initializing session:', err)
      setError('An unexpected error occurred: ' + err.message)
      setInitializing(false)
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

    setLoading(true)

    try {
      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to set password')
        return
      }

      setSuccess(true)
      
      // Redirect to app after 2 seconds
      setTimeout(() => {
        router.push('/app')
      }, 2000)
    } catch (err: any) {
      console.error('Error setting password:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
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
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#6d69ff]" />
                <p className="text-sm text-gray-600">Initializing your account...</p>
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
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Account Created Successfully</h2>
            </div>
            <CardContent className="p-8">
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  Your account has been set up successfully! You will be redirected to the app shortly.
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#6d69ff]" />
                </div>
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
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Accept Invitation</h2>
          </div>
          <CardContent className="p-8">
            {email && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Email:</strong> {email}
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Set Password</Label>
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
                <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : 'Accept Invitation & Create Account'}
              </Button>
            </form>
            <div className="mt-8 text-center text-xs border-t border-slate-100 pt-6">
              <Link href="/auth/login" className="text-slate-900 hover:underline font-bold">
                Already have an account? Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

