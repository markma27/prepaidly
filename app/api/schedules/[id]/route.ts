import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'
import { logAuditEntry } from '@/lib/auditLogger'

interface UpdateScheduleRequest {
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
}

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

    // Get the specific schedule with its entries (entity-aware)
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(`
        *,
        schedule_entries (*)
      `)
      .eq('id', params.id)
      .single()

    // Verify user has access to this schedule's entity
    if (schedule) {
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
    }

    if (error) {
      console.error('Error fetching schedule:', error)
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ schedule })

  } catch (error) {
    console.error('Error in schedule API GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    const { schedule, formData }: UpdateScheduleRequest = await request.json()

    if (!schedule || !formData) {
      return NextResponse.json(
        { error: 'Missing schedule or form data' },
        { status: 400 }
      )
    }

    // Fetch existing schedule data for comparison
    const { data: existingSchedule, error: checkError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', params.id)
      .single()

    if (checkError || !existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this schedule's entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', existingSchedule.entity_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Update the main schedule record
    const { data: updatedSchedule, error: scheduleError } = await supabase
      .from('schedules')
      .update({
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
      .eq('id', params.id)
      .select()
      .single()

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    // Delete existing schedule entries
    const { error: deleteError } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('schedule_id', params.id)

    if (deleteError) {
      console.error('Error deleting old schedule entries:', deleteError)
      return NextResponse.json(
        { error: 'Failed to update schedule entries' },
        { status: 500 }
      )
    }

    // Insert new schedule entries
    const scheduleEntries = schedule.map(entry => ({
      schedule_id: params.id,
      period: entry.period,
      amount: entry.amount,
      cumulative: entry.cumulative,
      remaining: entry.remaining,
    }))

    const { error: entriesError } = await supabase
      .from('schedule_entries')
      .insert(scheduleEntries)

    if (entriesError) {
      console.error('Error saving new schedule entries:', entriesError)
      return NextResponse.json(
        { error: 'Failed to save schedule entries' },
        { status: 500 }
      )
    }

    // Create detailed change log
    const changes: string[] = []
    
    if (existingSchedule.type !== formData.type) {
      changes.push(`Type: ${existingSchedule.type} → ${formData.type}`)
    }
    if (existingSchedule.vendor !== formData.vendor) {
      changes.push(`Contact: "${existingSchedule.vendor}" → "${formData.vendor}"`)
    }
    if (existingSchedule.total_amount !== parseFloat(formData.totalAmount)) {
      changes.push(`Amount: ${existingSchedule.total_amount} → ${formData.totalAmount}`)
    }
    if (existingSchedule.service_start !== formData.serviceStart) {
      changes.push(`Service start: ${existingSchedule.service_start} → ${formData.serviceStart}`)
    }
    if (existingSchedule.service_end !== formData.serviceEnd) {
      changes.push(`Service end: ${existingSchedule.service_end} → ${formData.serviceEnd}`)
    }
    if (existingSchedule.reference_number !== formData.referenceNumber) {
      changes.push(`Reference: "${existingSchedule.reference_number}" → "${formData.referenceNumber}"`)
    }
    if ((existingSchedule.description || '') !== (formData.description || '')) {
      changes.push(`Description: "${existingSchedule.description || ''}" → "${formData.description || ''}"`)
    }
    if (existingSchedule.account_id !== formData.accountId) {
      changes.push(`Account ID: ${existingSchedule.account_id} → ${formData.accountId}`)
    }

    const detailsText = changes.length > 0 
      ? `Schedule updated with changes: ${changes.join(', ')}`
      : `Schedule regenerated with same values`

    // Log audit entry for schedule update
    await logAuditEntry({
      scheduleId: params.id,
      entityId: existingSchedule.entity_id,
      action: 'Schedule Updated',
      actionType: 'updated',
      details: detailsText,
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
      schedule: updatedSchedule,
      message: 'Schedule successfully updated'
    })

  } catch (error) {
    console.error('Error in schedule API PUT:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 