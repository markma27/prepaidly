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

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check for error or success messages in URL params
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const messageParam = searchParams.get('message')

    if (errorParam) {
      setError(errorDescription || errorParam)
    } else if (messageParam === 'password_reset_success') {
      setSuccess('Your password has been successfully reset. Please log in with your new password.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null) // Clear success message when attempting to login
    setLoading(true)

    try {
      const supabase = createClient()
      
      // Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials') || 
            signInError.message.includes('Email not confirmed')) {
          setError('Invalid email or password')
        } else {
          setError(signInError.message || 'Sign in failed, please try again')
        }
        return
      }

      if (!data.user) {
        setError('Sign in failed. No user data returned.')
        return
      }

      // Store user info in sessionStorage for backward compatibility with existing code
      // The Supabase session is automatically stored in cookies by @supabase/ssr
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          // Add any other user metadata you need
        }))
      }

      router.push('/app')
      router.refresh()
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Sign in failed, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-[400px] space-y-8">
        {/* Logo */}
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

        {/* Login Card */}
        <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/35 to-[#6d69ff]/10 py-4 flex items-center justify-center border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sign In</h2>
          </div>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-brand/5 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-brand/5 transition-all"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 p-3 text-xs font-medium text-green-600 border border-green-100">
                  {success}
                </div>
              )}
              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-xs text-slate-600 hover:text-slate-900 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 bg-[#6d69ff] text-white hover:bg-[#5a56e6] active:bg-[#4a46cc] active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-[#6d69ff]/10 mt-2" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : 'Sign In'}
              </Button>
            </form>
            <div className="mt-8 text-center text-xs border-t border-slate-100 pt-6">
              <span className="text-slate-400 font-medium">Don&apos;t have an account?</span>{' '}
              <Link href="/auth/signup" className="text-slate-900 hover:underline font-bold ml-1">
                Get Started
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
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
      <LoginContent />
    </Suspense>
  )
}
