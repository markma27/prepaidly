import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invitationId = params.id

    // Get invitation details to verify permissions
    const { data: invitation, error: inviteError } = await supabase
      .from('entity_invitations')
      .select('entity_id, email')
      .eq('id', invitationId)
      .eq('accepted', false)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Verify user has permission to cancel this invitation
    const { data: userAccess, error: accessError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', invitation.entity_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to entity' }, { status: 403 })
    }

    if (!['super_admin', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('entity_invitations')
      .delete()
      .eq('id', invitationId)

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError)
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 })
    }

    console.log('Invitation cancelled audit log:', {
      entityId: invitation.entity_id,
      userId: user.id,
      action: 'invitation_cancelled',
      cancelled_email: invitation.email
    })

    return NextResponse.json({ message: 'Invitation cancelled successfully' })

  } catch (error) {
    console.error('Error in cancel invitation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 