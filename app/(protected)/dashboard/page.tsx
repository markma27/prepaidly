import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import DashboardWithEntitySelector from "@/components/DashboardWithEntitySelector"
import { DashboardSkeleton } from '@/components/DashboardSkeleton'

export default async function DashboardPage({
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
  
  // If no entity is specified, redirect to Demo Company (for first-time users)
  if (!params.entity) {
    // Always redirect to Demo Company for first-time access or direct dashboard access
    const entityId = '00000000-0000-0000-0000-000000000001' // Demo Company
    redirect(`/dashboard?entity=${entityId}`)
  }

  const selectedEntityId = params.entity

  // Verify user has access to the selected entity
  const { data: userAccess } = await supabase
    .from('entity_users')
    .select('id')
    .eq('entity_id', selectedEntityId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // If user doesn't have access, get their first available entity and redirect
  if (!userAccess) {
    const { data: userEntities } = await supabase
      .from('entity_users')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (userEntities && userEntities.length > 0) {
      redirect(`/dashboard?entity=${userEntities[0].entity_id}`)
    } else {
      // User has no entities - should not happen if migration worked
      redirect('/entities')
    }
  }

  // Fetch schedules for the selected entity
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('entity_id', selectedEntityId)
    .order('created_at', { ascending: false })

  // Fetch entity-specific settings for currency display and account lookup
  let { data: userSettings, error: settingsError } = await supabase
    .from('entity_settings')
    .select('*')
    .eq('entity_id', selectedEntityId)
    .single()

  // If entity settings don't exist, try to get user settings and migrate
  if (settingsError && settingsError.code === 'PGRST116') {
    const { data: oldUserSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
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
    }
  }

  const userCurrency = userSettings?.currency || 'USD'
  // Map currency to symbol
  const currencySymbols: { [key: string]: string } = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': '$',
    'AUD': '$',
    'JPY': '¥',
    'CHF': 'CHF',
    'CNY': '¥'
  }
  const currencySymbol = currencySymbols[userCurrency] || '$'

  // Get recent schedules for data table
  const recentSchedules = schedules?.slice(0, 5) || []

  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardWithEntitySelector 
        initialEntityId={selectedEntityId}
        schedules={schedules || []}
        recentSchedules={recentSchedules}
        currency={userCurrency}
        currencySymbol={currencySymbol}
        userSettings={userSettings}
      />
    </Suspense>
  )
}

function DashboardLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Immediate loading feedback */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="h-8 w-32 bg-muted rounded mb-2"></div>
          <div className="h-4 w-96 bg-muted rounded"></div>
        </div>
      </div>

      {/* Quick skeleton cards */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  )
}
