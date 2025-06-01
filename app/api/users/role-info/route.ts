import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')

    if (!entityId) {
      return NextResponse.json({ error: 'Entity ID is required' }, { status: 400 })
    }

    // Get user's role for this entity
    const { data: userAccess, error: accessError } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accessError || !userAccess) {
      return NextResponse.json({ role: null })
    }

    return NextResponse.json({ 
      role: userAccess.role,
      userId: user.id,
      entityId 
    })

  } catch (error) {
    console.error('Error fetching user role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 