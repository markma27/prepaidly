import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get entity ID from search params
    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entity') || '00000000-0000-0000-0000-000000000001'

    // Verify user has access to this entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('id')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this entity' }, { status: 403 })
    }

    // Try to get entity-specific settings first
    let { data: settings, error } = await supabase
      .from('entity_settings')
      .select('*')
      .eq('entity_id', entityId)
      .single()

    // If entity settings don't exist, fall back to user settings and migrate
    if (error && error.code === 'PGRST116') {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (userSettings) {
        // Create entity settings from user settings
        const { data: newEntitySettings } = await supabase
          .from('entity_settings')
          .insert({
            entity_id: entityId,
            currency: userSettings.currency,
            timezone: userSettings.timezone,
            prepaid_accounts: userSettings.prepaid_accounts,
            unearned_accounts: userSettings.unearned_accounts,
            xero_integration: userSettings.xero_integration,
          })
          .select()
          .single()

        settings = newEntitySettings
      } else {
        // Create default entity settings
        const { data: defaultSettings } = await supabase
          .from('entity_settings')
          .insert({
            entity_id: entityId,
          })
          .select()
          .single()

        settings = defaultSettings
      }
    }

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error in settings GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const entityId = body.entityId || '00000000-0000-0000-0000-000000000001'
    
    console.log('Settings POST body:', body)
    console.log('Entity ID for settings save:', entityId)

    // Verify user has access to this entity (temporarily allowing all roles)
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this entity' }, { status: 403 })
    }

    console.log('User role for entity settings:', userAccess.role, 'Entity ID:', entityId)
    
    const settingsData = {
      entity_id: entityId,
      currency: body.currency,
      timezone: body.timezone,
      prepaid_accounts: body.prepaid_accounts,
      unearned_accounts: body.unearned_accounts,
      xero_integration: body.xero_integration,
      updated_at: new Date().toISOString(),
    }

    // Check if entity settings already exist
    const { data: existingSettings } = await supabase
      .from('entity_settings')
      .select('id')
      .eq('entity_id', entityId)
      .single()

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('entity_settings')
        .update(settingsData)
        .eq('entity_id', entityId)
        .select()
        .single()
    } else {
      // Insert new settings
      result = await supabase
        .from('entity_settings')
        .insert({
          ...settingsData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving settings:', result.error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Settings saved successfully',
      settings: result.data 
    })
  } catch (error) {
    console.error('Error in settings POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 