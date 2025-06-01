import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, description } = await request.json()
    const entityId = params.id

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Entity name is required and must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess || !['super_admin', 'admin'].includes(userAccess.role)) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      )
    }

    // Update the entity
    const { data: updatedEntity, error: updateError } = await supabase
      .from('entities')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating entity:', updateError)
      return NextResponse.json(
        { error: 'Failed to update entity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      entity: updatedEntity,
      message: 'Entity updated successfully'
    })

  } catch (error) {
    console.error('Error in entity PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 