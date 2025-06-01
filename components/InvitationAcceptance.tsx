'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, Crown, Users, AlertCircle, CheckCircle, Mail } from 'lucide-react'

interface InvitationDetails {
  id: string
  email: string
  role: string
  entity_name: string
  entity_id: string
  invited_by_name: string
  expires_at: string
}

interface InvitationAcceptanceProps {
  invitation: InvitationDetails
}

export function InvitationAcceptance({ invitation }: InvitationAcceptanceProps) {
  const router = useRouter()
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      case 'user':
        return <Users className="h-4 w-4 text-green-600" />
      default:
        return <Users className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
      case 'admin':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100'
      case 'user':
        return 'bg-green-100 text-green-800 hover:bg-green-100'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
    }
  }

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAccepting(true)
    setError('')
    setSuccess('')

    // Validate form
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Please enter your first and last name')
      setIsAccepting(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setIsAccepting(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsAccepting(false)
      return
    }

    try {
      const response = await fetch('/api/users/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationId: invitation.id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          password: formData.password
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation')
      }

      setSuccess('Account created successfully! Redirecting to login...')
      
      // Redirect to login after success
      setTimeout(() => {
        router.push('/login?message=Account created successfully. Please log in.')
      }, 2000)

    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      setError(error.message || 'Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Mail className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">You're Invited!</CardTitle>
        <CardDescription>
          {invitation.invited_by_name} has invited you to join <strong>{invitation.entity_name}</strong> on Prepaidly.io
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Invitation Details */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Email:</span>
            <span className="text-sm text-muted-foreground">{invitation.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Role:</span>
            <div className="flex items-center space-x-2">
              {getRoleIcon(invitation.role)}
              <Badge className={getRoleBadgeColor(invitation.role)}>
                {invitation.role.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Expires:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(invitation.expires_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleAcceptInvitation} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Doe"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter a secure password"
              required
              minLength={8}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm your password"
              required
              minLength={8}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isAccepting}>
            {isAccepting ? 'Creating Account...' : 'Accept Invitation & Create Account'}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By accepting this invitation, you agree to join {invitation.entity_name} and create an account on Prepaidly.io
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 