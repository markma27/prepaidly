import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'
import { logAuditEntry } from '@/lib/auditLogger'

interface SaveScheduleRequest {
  schedule: ScheduleEntry[]
  formData: {
    type: 'prepayment' | 'unearned'
    accountId: string
    vendor: string
    invoiceDate: string
    totalAmount: string
    serviceStart: string
    serviceEnd: string
    description?: string
    referenceNumber: string
  }
  entityId: string
}

export async function POST(request: NextRequest) {
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

    const { schedule, formData, entityId }: SaveScheduleRequest = await request.json()

    if (!schedule || !formData || !entityId) {
      return NextResponse.json(
        { error: 'Missing schedule, form data, or entity ID' },
        { status: 400 }
      )
    }

    // Verify user has access to the specified entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json(
        { error: 'Access denied to specified entity' },
        { status: 403 }
      )
    }

    // Start a transaction by inserting the main schedule record
    const { data: scheduleRecord, error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        user_id: user.id,
        entity_id: entityId,
        type: formData.type,
        account_id: formData.accountId,
        vendor: formData.vendor,
        invoice_date: formData.invoiceDate,
        total_amount: parseFloat(formData.totalAmount),
        service_start: formData.serviceStart,
        service_end: formData.serviceEnd,
        description: formData.description || null,
        reference_number: formData.referenceNumber,
      })
      .select()
      .single()

    if (scheduleError) {
      console.error('Error saving schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Failed to save schedule' },
        { status: 500 }
      )
    }

    // Insert all schedule entries
    const scheduleEntries = schedule.map(entry => ({
      schedule_id: scheduleRecord.id,
      period: entry.period,
      amount: entry.amount,
      cumulative: entry.cumulative,
      remaining: entry.remaining,
    }))

    const { error: entriesError } = await supabase
      .from('schedule_entries')
      .insert(scheduleEntries)

    if (entriesError) {
      console.error('Error saving schedule entries:', entriesError)
      // Try to clean up the schedule record if entries failed
      await supabase.from('schedules').delete().eq('id', scheduleRecord.id)
      
      return NextResponse.json(
        { error: 'Failed to save schedule entries' },
        { status: 500 }
      )
    }

    // Log audit entry for schedule creation
    await logAuditEntry({
      scheduleId: scheduleRecord.id,
      entityId: entityId,
      action: 'Schedule Created',
      actionType: 'created',
      details: `${formData.type === 'prepayment' ? 'Prepaid Expense' : 'Unearned Revenue'} schedule created for ${formData.vendor} with total amount ${formData.totalAmount}`,
      userId: user.id,
      userEmail: user.email || undefined,
      newValues: {
        type: formData.type,
        vendor: formData.vendor,
        total_amount: formData.totalAmount,
        service_start: formData.serviceStart,
        service_end: formData.serviceEnd,
        reference_number: formData.referenceNumber
      }
    })

    return NextResponse.json({
      success: true,
      schedule: scheduleRecord,
      message: 'Schedule successfully added to register'
    })

  } catch (error) {
    console.error('Error in schedule API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    // Get user's entities and their schedules
    // For now, get Demo Company schedules (later we'll add entity switching)
    const entityId = '00000000-0000-0000-0000-000000000001' // Demo Company

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        *,
        schedule_entries (*)
      `)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching schedules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ schedules })

  } catch (error) {
    console.error('Error in schedule API GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 