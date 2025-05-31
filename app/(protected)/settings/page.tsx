import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SettingsForm from '@/components/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch user settings
  const { data: userSettings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
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
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/dashboard">
              <Button className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="ml-8">
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage your account preferences and integrations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <SettingsForm initialSettings={userSettings} />
      </main>
    </div>
  )
} 