import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { logAuditEntry } from '@/lib/auditLogger'

interface AuditLogRequest {
  scheduleId: string
  action: string
  actionType: 'created' | 'updated' | 'generated' | 'downloaded'
  details: string
}

export async function POST(request: NextRequest) {
  try {
    const { scheduleId, action, actionType, details }: AuditLogRequest = await request.json()

    if (!scheduleId || !action || !actionType || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get schedule's entity_id
    const supabase = await createServerSupabaseClient()
    const { data: schedule } = await supabase
      .from('schedules')
      .select('entity_id')
      .eq('id', scheduleId)
      .single()

    const entityId = schedule?.entity_id || '00000000-0000-0000-0000-000000000001' // Fallback to Demo Company

    await logAuditEntry({
      scheduleId,
      entityId,
      action,
      actionType,
      details
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging audit entry:', error)
    return NextResponse.json(
      { error: 'Failed to log audit entry' },
      { status: 500 }
    )
  }
} 