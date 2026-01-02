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
import { authApi, ApiError } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { user } = await authApi.login(email, password)
      
      // Store user info in sessionStorage (in production, use proper session management)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(user))
      }

      router.push('/app/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('Invalid email or password')
        } else {
          setError(err.message || 'Sign in failed, please try again')
        }
      } else {
        setError('Sign in failed, please try again')
      }
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
          <div className="bg-gradient-to-r from-[#6d69ff]/50 via-[#6d69ff]/25 to-[#6d69ff]/10 py-4 flex items-center justify-center border-b border-slate-100">
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
