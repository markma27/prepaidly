import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SearchableScheduleTable from '@/components/SearchableScheduleTable'

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch all schedules for the user
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
  }

  // Fetch user's settings for currency display
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
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
              <h1 className="text-2xl font-bold text-foreground">Schedule Register</h1>
              <p className="text-muted-foreground">View and manage your saved schedules</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
        />
      </main>
    </div>
  )
} 