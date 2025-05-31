import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'

interface SaveScheduleRequest {
  schedule: ScheduleEntry[]
  formData: {
    type: 'prepayment' | 'unearned'
    vendor: string
    invoiceDate: string
    totalAmount: string
    serviceStart: string
    serviceEnd: string
    description?: string
  }
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

    const { schedule, formData }: SaveScheduleRequest = await request.json()

    if (!schedule || !formData) {
      return NextResponse.json(
        { error: 'Missing schedule or form data' },
        { status: 400 }
      )
    }

    // Start a transaction by inserting the main schedule record
    const { data: scheduleRecord, error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        user_id: user.id,
        type: formData.type,
        vendor: formData.vendor,
        invoice_date: formData.invoiceDate,
        total_amount: parseFloat(formData.totalAmount),
        service_start: formData.serviceStart,
        service_end: formData.serviceEnd,
        description: formData.description || null,
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

    // Get all schedules for the user
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        *,
        schedule_entries (*)
      `)
      .eq('user_id', user.id)
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