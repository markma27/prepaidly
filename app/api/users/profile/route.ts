import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { firstName, lastName, phone, timezone, emailNotifications, marketingEmails } = await request.json()

    // Validate input
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
    }

    // Update user profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null,
        timezone: timezone || 'UTC',
        email_notifications: emailNotifications ?? true,
        marketing_emails: marketingEmails ?? false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    console.log('Profile updated audit log:', {
      userId: user.id,
      action: 'profile_updated',
      details: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim(),
        timezone
      }
    })

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      profile: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim(),
        timezone,
        email_notifications: emailNotifications,
        marketing_emails: marketingEmails
      }
    })

  } catch (error) {
    console.error('Error in profile update API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 