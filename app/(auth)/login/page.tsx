'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loginStep, setLoginStep] = useState<'idle' | 'authenticating' | 'redirecting'>('idle')
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setLoginStep('authenticating')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setError('Check your email for the confirmation link!')
        setLoading(false)
        setLoginStep('idle')
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        
        // Show redirecting state
        setLoginStep('redirecting')
        
        // After successful login, get user's last entity and redirect to appropriate dashboard
        if (authData.user) {
          try {
            // Check for saved entity in localStorage first
            let entityId = localStorage.getItem('selectedEntityId')
            
            // If no saved entity (first-time login), always go to Demo Company
            if (!entityId) {
              entityId = '00000000-0000-0000-0000-000000000001' // Demo Company
              console.log('First-time login detected, redirecting to Demo Company')
            }
            
            // Save to localStorage for future logins
            localStorage.setItem('selectedEntityId', entityId)
            
            // Add a small delay to show the redirecting state
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Redirect to entity dashboard
            router.push(`/dashboard?entity=${entityId}`)
          } catch (entityError) {
            console.error('Error during login redirect:', entityError)
            // Fallback to basic dashboard (which will redirect to entity dashboard)
            router.push('/dashboard')
          }
        }
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred')
      setLoading(false)
      setLoginStep('idle')
    }
  }

  const getLoadingMessage = () => {
    switch (loginStep) {
      case 'authenticating':
        return 'Signing in...'
      case 'redirecting':
        return 'Redirecting to dashboard...'
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <div className="text-lg font-medium">{getLoadingMessage()}</div>
              <div className="text-sm text-muted-foreground">Please wait...</div>
            </div>
          </div>
        </div>
      )}
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp 
              ? 'Enter your details to create your Prepaidly account'
              : 'Enter your credentials to access your Prepaidly dashboard'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {getLoadingMessage()}
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer disabled:opacity-50"
            >
              {isSignUp 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 