'use client'

import { useState } from 'react'
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

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        setError(resetError.message || 'Failed to send password reset email')
        return
      }

      setSuccess(true)
    } catch (err: any) {
      console.error('Error sending password reset email:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
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
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Check Your Email</h2>
            </div>
            <CardContent className="p-8">
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  We've sent a password reset link to <strong>{email}</strong>. Please check your email and click the link to reset your password.
                </p>
                <p className="text-xs text-gray-500 text-center">
                  The link will expire in 1 hour. If you don't see the email, please check your spam folder.
                </p>
                <Button
                  onClick={() => router.push('/auth/login')}
                  className="w-full h-11 bg-[#6d69ff] text-white hover:bg-[#5a56e6] active:bg-[#4a46cc] active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-[#6d69ff]/10 mt-4"
                >
                  Back to Login
                </Button>
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
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Forgot Password</h2>
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
              <p className="text-xs text-gray-500">
                Enter your email address and we'll send you a link to reset your password.
              </p>
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
                    Sending...
                  </>
                ) : 'Send Reset Link'}
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

