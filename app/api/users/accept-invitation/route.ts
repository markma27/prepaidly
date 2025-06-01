import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { invitationId, firstName, lastName, password } = await request.json()

    // Validate input
    if (!invitationId || !firstName || !lastName || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('entity_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('accepted', false)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or already accepted' }, { status: 404 })
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.some(user => user.email === invitation.email)

    if (userExists) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    // Create the user account
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true, // Auto-confirm email since they were invited
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (createError || !newUser.user) {
      console.error('Error creating user:', createError)
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        first_name: firstName,
        last_name: lastName
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Don't fail the request if profile creation fails
    }

    // Add user to entity
    const { error: entityUserError } = await supabase
      .from('entity_users')
      .insert({
        entity_id: invitation.entity_id,
        user_id: newUser.user.id,
        role: invitation.role,
        is_active: true
      })

    if (entityUserError) {
      console.error('Error adding user to entity:', entityUserError)
      return NextResponse.json({ error: 'Failed to add user to entity' }, { status: 500 })
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('entity_invitations')
      .update({
        accepted: true,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      // Don't fail the request if this fails
    }

    console.log('Invitation accepted audit log:', {
      entityId: invitation.entity_id,
      userId: newUser.user.id,
      action: 'invitation_accepted',
      email: invitation.email,
      role: invitation.role
    })

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        first_name: firstName,
        last_name: lastName
      }
    })

  } catch (error) {
    console.error('Error in accept invitation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 