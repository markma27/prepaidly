import { createServerSupabaseClient } from '@/lib/supabaseClient'
import SettingsForm from '@/components/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user settings
  const { data: userSettings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user?.id)
    .single()

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and integrations</p>
        </div>
        <div className="max-w-4xl">
          <SettingsForm initialSettings={userSettings} />
        </div>
      </div>
    </div>
  )
} 