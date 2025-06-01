import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
// import { auditLog } from '@/lib/auditLogger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, role, entityId } = await request.json()

    // Validate input
    if (!email || !role || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Verify user has permission to invite to this entity
    const { data: userAccess, error: accessError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to entity' }, { status: 403 })
    }

    // Check permissions: super_admin can invite anyone, admin can only invite users
    if (!['super_admin', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (userAccess.role === 'admin' && role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot invite other admins' }, { status: 403 })
    }

    // Check if user with this email already exists and is a member of this entity
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      
      if (existingUser) {
        // Check if this user is already a member of the entity
        const { data: existingMember } = await supabase
          .from('entity_users')
          .select('id')
          .eq('entity_id', entityId)
          .eq('user_id', existingUser.id)
          .single()

        if (existingMember) {
          return NextResponse.json({ error: 'User is already a member of this entity' }, { status: 400 })
        }
      }
    } catch (error) {
      console.warn('Could not check existing users:', error)
      // Continue with invitation if we can't check - better to allow than block
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('entity_invitations')
      .select('id')
      .eq('entity_id', entityId)
      .eq('email', email.toLowerCase())
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvitation) {
      return NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 400 })
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('entity_invitations')
      .insert([{
        entity_id: entityId,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString()
      }])
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Get entity name for email
    const { data: entity } = await supabase
      .from('entities')
      .select('name')
      .eq('id', entityId)
      .single()

    // Send invitation email (placeholder - you'll need to implement email service)
    try {
      await sendInvitationEmail({
        email: email.toLowerCase(),
        token,
        entityName: entity?.name || 'Unknown Entity',
        role,
        inviterName: user.email || 'Unknown User'
      })
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      // Don't fail the request if email fails, but log it
    }

    // TODO: Add audit logging for user invitations
    console.log('User invitation audit log:', {
      entityId,
      userId: user.id,
      action: 'user_invited',
      invited_email: email,
      role
    })

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at
      }
    })

  } catch (error) {
    console.error('Error in invite API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Placeholder function for sending invitation emails
async function sendInvitationEmail({
  email,
  token,
  entityName,
  role,
  inviterName
}: {
  email: string
  token: string
  entityName: string
  role: string
  inviterName: string
}) {
  // TODO: Implement email service (e.g., Resend, SendGrid, etc.)
  // For now, we'll just log the invitation details
  console.log('Invitation email would be sent:', {
    to: email,
    subject: `You're invited to join ${entityName} on Prepaidly.io`,
    invitationLink: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
    entityName,
    role,
    inviterName
  })

  // In production, you would send an actual email here:
  /*
  const emailContent = `
    Hello,
    
    ${inviterName} has invited you to join ${entityName} on Prepaidly.io as a ${role}.
    
    Click the link below to accept your invitation and set up your account:
    ${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}
    
    This invitation will expire in 7 days.
    
    Best regards,
    The Prepaidly.io Team
  `
  
  await emailService.send({
    to: email,
    subject: `You're invited to join ${entityName} on Prepaidly.io`,
    text: emailContent
  })
  */
} 