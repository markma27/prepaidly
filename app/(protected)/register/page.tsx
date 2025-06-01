import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import SearchableScheduleTable from '@/components/SearchableScheduleTable'
import RegisterWithEntitySelector from '@/components/RegisterWithEntitySelector'

export default async function RegisterPage({
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

  // Fetch all schedules for the selected entity
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select(`
      *,
      schedule_entries (*)
    `)
    .eq('entity_id', selectedEntityId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching schedules:', error)
  }

  // Fetch user's settings for currency display
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user?.id)
    .single()

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

  return (
    <RegisterWithEntitySelector
      initialEntityId={selectedEntityId}
      schedules={schedules || []}
      currency={userCurrency}
      currencySymbol={currencySymbol}
      userSettings={userSettings}
    />
  )
} 