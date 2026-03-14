'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { xeroAuthApi } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

function LoginContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/app'
      return
    }
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  const handleXeroLogin = () => {
    try {
      setLoading(true)
      setError(null)
      const loginUrl = xeroAuthApi.getLoginUrl()
      window.location.href = loginUrl
    } catch (err: any) {
      console.error('Error starting Xero login:', err)
      setError(err.message || 'Failed to start Xero login')
      setLoading(false)
    }
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
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sign In</h2>
          </div>
          <CardContent className="p-8">
            <p className="text-sm text-slate-600 text-center mb-6">
              Sign in with your Xero account to access Prepaidly.
            </p>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100 mb-4">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleXeroLogin}
              disabled={loading}
              className="w-full h-12 bg-[#13B5EA] text-white hover:bg-[#0e9fd0] active:bg-[#0c8db8] active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-[#13B5EA]/20 rounded-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to Xero...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8L8.5 12L4 16M9.5 8L14 12L9.5 16M15 8L19.5 12L15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Login with Xero
                </>
              )}
            </button>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 group">
            <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to home
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
