import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import SearchableScheduleTable from '@/components/SearchableScheduleTable'

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all schedules for the user
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select(`
      *,
      schedule_entries (*)
    `)
    .eq('user_id', user?.id)
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
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Schedule Register</h1>
          <p className="text-muted-foreground">View and manage your saved schedules</p>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              All Schedules ({schedules?.length || 0})
            </h2>
            <p className="text-muted-foreground">
              Your saved prepayment and unearned revenue schedules
            </p>
          </div>
          <Link href="/new-schedule">
            <Button>
              Create New Schedule
            </Button>
          </Link>
        </div>

        <SearchableScheduleTable 
          schedules={schedules || []} 
          currency={userCurrency}
          currencySymbol={currencySymbol}
          userSettings={userSettings}
        />
      </div>
    </div>
  )
} 