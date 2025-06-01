'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import SearchableScheduleTable from '@/components/SearchableScheduleTable'


interface Schedule {
  id: string
  vendor: string
  reference_number: string
  type: 'prepayment' | 'unearned'
  total_amount: number
  service_start: string
  service_end: string
  description: string
  invoice_date: string
  created_at: string
  account_id?: string
  schedule_entries?: any[]
}

interface UserSettings {
  prepaid_accounts: Array<{ id: string; name: string; account: string }>
  unearned_accounts: Array<{ id: string; name: string; account: string }>
  currency?: string
  [key: string]: any
}

interface RegisterWithEntitySelectorProps {
  initialEntityId: string
  schedules: Schedule[]
  currency: string
  currencySymbol: string
  userSettings: UserSettings | null
}

export default function RegisterWithEntitySelector({
  initialEntityId,
  schedules,
  currency,
  currencySymbol,
  userSettings
}: RegisterWithEntitySelectorProps) {
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
    setCurrentEntityId(entityId)
    
    // Update URL with new entity
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('entity', entityId)
    router.push(`/register?${newSearchParams.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Schedule Register</h1>
          <p className="text-muted-foreground">View and manage your saved schedules</p>
        </div>

        {/* Schedule Count and Create Button */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              All Schedules ({schedules?.length || 0})
            </h2>
            <p className="text-muted-foreground">
              Your saved prepayment and unearned revenue schedules
            </p>
          </div>
          <Link href={`/new-schedule?entity=${currentEntityId}`} className="cursor-pointer">
            <Button className="cursor-pointer">
              Create New Schedule
            </Button>
          </Link>
        </div>

        {/* Schedule Table */}
        <SearchableScheduleTable 
          schedules={schedules} 
          currency={currency}
          currencySymbol={currencySymbol}
          userSettings={userSettings || undefined}
        />
      </div>
    </div>
  )
} 