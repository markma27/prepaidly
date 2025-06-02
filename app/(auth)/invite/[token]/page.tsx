import { createClient } from '@/lib/supabaseClient'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InvitationAcceptance } from '@/components/InvitationAcceptance'

interface InvitationDetails {
  id: string
  email: string
  role: string
  entity_name: string
  entity_id: string
  invited_by_name: string
  expires_at: string
}

async function getInvitationDetails(token: string): Promise<InvitationDetails | null> {
  const supabase = createClient()
  
  const { data: invitation, error } = await supabase
    .from('entity_invitations')
    .select(`
      id,
      email,
      role,
      entity_id,
      expires_at,
      entities:entity_id(name),
      profiles:invited_by(first_name, last_name)
    `)
    .eq('token', token)
    .eq('accepted', false)
    .single()

  if (error || !invitation) {
    return null
  }

  // Check if invitation has expired
  if (new Date(invitation.expires_at) < new Date()) {
    return null
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    entity_name: (invitation.entities as any)?.name || 'Unknown Entity',
    entity_id: invitation.entity_id,
    invited_by_name: (invitation.profiles as any)?.first_name && (invitation.profiles as any)?.last_name
      ? `${(invitation.profiles as any).first_name} ${(invitation.profiles as any).last_name}`
      : 'Someone',
    expires_at: invitation.expires_at
  }
}

export default async function InvitePage({
  params
}: {
  params: { token: string }
}) {
  const invitation = await getInvitationDetails(params.token)

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Invitation Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
            </p>
            <Link 
              href="/login" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6">
        <InvitationAcceptance invitation={invitation} />
      </div>
    </div>
  )
} 