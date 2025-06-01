'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { cn } from '@/lib/utils'


interface Schedule {
  id: string
  type: string
  vendor: string
  invoice_date: string
  total_amount: number
  service_start: string
  service_end: string
  description: string
  created_at: string
  account_id?: string
}

interface UserSettings {
  prepaid_accounts: Array<{ id: string; name: string; account: string }>
  unearned_accounts: Array<{ id: string; name: string; account: string }>
  currency?: string
  [key: string]: any
}

interface DashboardWithEntitySelectorProps {
  initialEntityId: string
  schedules: Schedule[]
  recentSchedules: Schedule[]
  currency: string
  currencySymbol: string
  userSettings: UserSettings | null
}

export default function DashboardWithEntitySelector({
  initialEntityId,
  schedules,
  recentSchedules,
  currency,
  currencySymbol,
  userSettings
}: DashboardWithEntitySelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentEntityId, setCurrentEntityId] = useState(initialEntityId)

  // Update entity from URL params
  useEffect(() => {
    const entityParam = searchParams.get('entity')
    if (entityParam && entityParam !== currentEntityId) {
      setCurrentEntityId(entityParam)
    }
  }, [searchParams, currentEntityId])

  const handleEntityChange = (entityId: string) => {
    if (entityId === currentEntityId) return
    
    setCurrentEntityId(entityId)
    
    // Update URL with new entity
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('entity', entityId)
    router.push(`/dashboard?${newSearchParams.toString()}`)
  }

  return (
    <div className={cn(
      "flex flex-col gap-4 py-4 md:gap-6 md:py-6"
    )}>
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your prepayment and unearned revenue schedules</p>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="px-4 sm:px-6 lg:px-8 animate-in slide-in-from-bottom-4 duration-700 delay-100">
        <SectionCards 
          schedules={schedules}
          currency={currency}
          currencySymbol={currencySymbol}
        />
      </div>
      
      <div className="px-4 sm:px-6 lg:px-8 animate-in slide-in-from-bottom-4 duration-700 delay-200">
        <ChartAreaInteractive 
          schedules={schedules} 
          currency={currency}
          currencySymbol={currencySymbol}
        />
      </div>
      
      <div className="px-4 sm:px-6 lg:px-8 animate-in slide-in-from-bottom-4 duration-700 delay-300">
        <DataTable 
          data={recentSchedules} 
          currencySymbol={currencySymbol}
          userSettings={userSettings || undefined}
          currentEntityId={currentEntityId}
        />
      </div>
    </div>
  )
} 