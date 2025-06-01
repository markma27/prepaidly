import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import SettingsForm from '@/components/SettingsForm'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Await searchParams as required by Next.js 15
  const params = await searchParams
  
  // Get the selected entity from URL params or default to Demo Company
  let selectedEntityId = params.entity || '00000000-0000-0000-0000-000000000001'

  // Verify user has access to the selected entity
  const { data: userAccess } = await supabase
    .from('entity_users')
    .select('id')
    .eq('entity_id', selectedEntityId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // If user doesn't have access, get their first available entity
  if (!userAccess) {
    const { data: userEntities } = await supabase
      .from('entity_users')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (userEntities && userEntities.length > 0) {
      selectedEntityId = userEntities[0].entity_id
    } else {
      // User has no entities - should not happen if migration worked
      redirect('/entities')
    }
  }

  // Fetch entity-specific settings
  let { data: userSettings, error } = await supabase
    .from('entity_settings')
    .select('*')
    .eq('entity_id', selectedEntityId)
    .single()

  // If entity settings don't exist, try to get user settings and migrate
  if (error && error.code === 'PGRST116') {
    const { data: oldUserSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user?.id)
      .single()

    if (oldUserSettings) {
      // Create entity settings from user settings
      const { data: newEntitySettings } = await supabase
        .from('entity_settings')
        .insert({
          entity_id: selectedEntityId,
          currency: oldUserSettings.currency,
          timezone: oldUserSettings.timezone,
          prepaid_accounts: oldUserSettings.prepaid_accounts,
          unearned_accounts: oldUserSettings.unearned_accounts,
          xero_integration: oldUserSettings.xero_integration,
        })
        .select()
        .single()

      userSettings = newEntitySettings
      error = null
    }
  }

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user settings:', error)
  }

  // Migrate old format to new format if needed
  if (userSettings && userSettings.prepaid_accounts && !Array.isArray(userSettings.prepaid_accounts)) {
    const oldPrepaid = userSettings.prepaid_accounts as any
    userSettings.prepaid_accounts = [
      { id: '1', name: 'Insurance Prepayments', account: oldPrepaid.insurance || '1240 - Prepaid Insurance' },
      { id: '2', name: 'Subscription Prepayments', account: oldPrepaid.subscription || '1250 - Prepaid Subscriptions' },
      { id: '3', name: 'Service Prepayments', account: oldPrepaid.service || '1260 - Prepaid Services' },
    ]
  }

  if (userSettings && userSettings.unearned_accounts && !Array.isArray(userSettings.unearned_accounts)) {
    const oldUnearned = userSettings.unearned_accounts as any
    userSettings.unearned_accounts = [
      { id: '1', name: 'Subscription Income', account: oldUnearned.subscription_income || '2340 - Unearned Subscription Revenue' },
    ]
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <SettingsForm initialSettings={userSettings} currentEntityId={selectedEntityId} />
        </div>
      </div>
    </div>
  )
} 