import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, entityId } = await request.json()

    // Validate input
    if (!userId || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify current user has permission to deactivate users in this entity
    const { data: currentUserAccess, error: accessError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accessError || !currentUserAccess) {
      return NextResponse.json({ error: 'Access denied to entity' }, { status: 403 })
    }

    if (!['super_admin', 'admin'].includes(currentUserAccess.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get target user's current role and status
    const { data: targetUser, error: targetError } = await supabase
      .from('entity_users')
      .select('role, is_active')
      .eq('entity_id', entityId)
      .eq('user_id', userId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found in entity' }, { status: 404 })
    }

    // Permission checks:
    // - Cannot deactivate yourself
    // - Cannot deactivate super admins
    // - Admins cannot deactivate other admins
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 })
    }

    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot deactivate super admin users' }, { status: 403 })
    }

    if (currentUserAccess.role === 'admin' && targetUser.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot deactivate other admin users' }, { status: 403 })
    }

    if (!targetUser.is_active) {
      return NextResponse.json({ error: 'User is already inactive' }, { status: 400 })
    }

    // Deactivate the user
    const { error: updateError } = await supabase
      .from('entity_users')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('entity_id', entityId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error deactivating user:', updateError)
      return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
    }

    console.log('User deactivated audit log:', {
      entityId,
      userId: user.id,
      action: 'user_deactivated',
      target_user: userId,
      target_role: targetUser.role
    })

    return NextResponse.json({ 
      message: 'User deactivated successfully'
    })

  } catch (error) {
    console.error('Error in user deactivation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 