import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch user's schedules for dashboard metrics
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', user.id)

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

  // Get recent schedules for data table
  const recentSchedules = schedules?.slice(0, 10) || []

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards 
        schedules={schedules || []} 
        currency={userCurrency}
        currencySymbol={currencySymbol}
      />
      <ChartAreaInteractive 
        schedules={schedules || []} 
        currency={userCurrency}
        currencySymbol={currencySymbol}
      />
      <DataTable 
        data={recentSchedules} 
        currencySymbol={currencySymbol}
      />
    </div>
  )
}
