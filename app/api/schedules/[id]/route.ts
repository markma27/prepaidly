import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'

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

    // Get the specific schedule with its entries
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(`
        *,
        schedule_entries (*)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

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

    // Verify the schedule belongs to the user
    const { data: existingSchedule, error: checkError } = await supabase
      .from('schedules')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existingSchedule) {
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
      .eq('user_id', user.id)
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