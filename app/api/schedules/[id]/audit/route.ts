import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

export async function GET(
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

    const scheduleId = params.id

    // First verify the user has access to this schedule's entity
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, entity_id')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', schedule.entity_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Fetch audit entries for this schedule
    const { data: auditEntries, error: auditError } = await supabase
      .from('schedule_audit')
      .select(`
        id,
        schedule_id,
        action,
        action_type,
        details,
        user_name,
        user_email,
        user_display_name,
        created_at
      `)
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false })

    if (auditError) {
      console.error('Error fetching audit trail:', auditError)
      return NextResponse.json(
        { error: 'Failed to fetch audit trail' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      auditEntries: auditEntries || []
    })
    
  } catch (error) {
    console.error('Error in audit trail API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 