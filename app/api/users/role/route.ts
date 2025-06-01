import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, role, entityId } = await request.json()

    // Validate input
    if (!userId || !role || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Verify current user has permission to modify roles in this entity
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

    // Get target user's current role
    const { data: targetUser, error: targetError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found in entity' }, { status: 404 })
    }

    // Permission checks:
    // - Super admins can change anyone except other super admins
    // - Admins can only change users (not other admins or super admins)
    // - No one can modify their own role
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 })
    }

    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify super admin roles' }, { status: 403 })
    }

    if (currentUserAccess.role === 'admin') {
      if (targetUser.role === 'admin') {
        return NextResponse.json({ error: 'Admins cannot modify other admin roles' }, { status: 403 })
      }
      if (role === 'admin') {
        return NextResponse.json({ error: 'Admins cannot promote users to admin' }, { status: 403 })
      }
    }

    // Update the user's role
    const { error: updateError } = await supabase
      .from('entity_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('entity_id', entityId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating user role:', updateError)
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
    }

    console.log('User role updated audit log:', {
      entityId,
      userId: user.id,
      action: 'user_role_updated',
      target_user: userId,
      old_role: targetUser.role,
      new_role: role
    })

    return NextResponse.json({ 
      message: 'User role updated successfully',
      oldRole: targetUser.role,
      newRole: role
    })

  } catch (error) {
    console.error('Error in role update API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 