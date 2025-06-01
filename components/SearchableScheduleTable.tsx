'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

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
  [key: string]: any
}

interface SearchableScheduleTableProps {
  schedules: Schedule[]
  currency?: string
  currencySymbol?: string
  userSettings?: UserSettings
}

export default function SearchableScheduleTable({ 
  schedules, 
  currency = 'USD', 
  currencySymbol = '$',
  userSettings 
}: SearchableScheduleTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy')
  }

  // Helper function to get account name by ID
  const getAccountName = (accountId: string | undefined, scheduleType: string): string => {
    if (!accountId || !userSettings) return 'N/A'
    
    const accounts = scheduleType === 'prepayment' 
      ? userSettings.prepaid_accounts 
      : userSettings.unearned_accounts
    
    const account = accounts?.find(acc => acc.id === accountId)
    return account?.account || 'Unknown Account'
  }

  // Filter and sort schedules based on search query
  const filteredSchedules = useMemo(() => {
    let result = schedules

    // Filter based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      
      result = schedules.filter((schedule) => {
        // Search by contact name (vendor)
        const matchesContact = schedule.vendor.toLowerCase().includes(query)
        
        // Search by reference number
        const matchesReference = schedule.reference_number.toLowerCase().includes(query)
        
        // Search by type
        const typeDisplay = schedule.type === 'prepayment' ? 'prepaid expense' : 'unearned revenue'
        const matchesType = typeDisplay.includes(query) || schedule.type.includes(query)
        
        // Search by amount (both formatted and raw)
        const rawAmount = schedule.total_amount.toString()
        const matchesAmount = rawAmount.includes(query)
        
        // Search by account name
        const accountName = getAccountName(schedule.account_id, schedule.type)
        const matchesAccount = accountName.toLowerCase().includes(query)
        
        return matchesContact || matchesReference || matchesType || matchesAmount || matchesAccount
      })
    }

    // Sort by invoice date (newest to oldest)
    return result.sort((a, b) => {
      const dateA = new Date(a.invoice_date)
      const dateB = new Date(b.invoice_date)
      return dateB.getTime() - dateA.getTime() // Descending order (newest first)
    })
  }, [schedules, searchQuery, userSettings])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Saved Schedules</CardTitle>
            <CardDescription>
              Click on any schedule to view details or download the CSV
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by contact, reference, account, type, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {filteredSchedules.length > 0 ? (
          <>
            {searchQuery && (
              <div className="mb-4 text-sm text-muted-foreground">
                Found {filteredSchedules.length} of {schedules.length} schedules
              </div>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-12 px-4">Type</TableHead>
                    <TableHead className="h-12 px-4">Contact</TableHead>
                    <TableHead className="h-12 px-4">Invoice Date</TableHead>
                    <TableHead className="h-12 px-4">Reference</TableHead>
                    <TableHead className="h-12 px-4">Account Code & Name</TableHead>
                    <TableHead className="h-12 px-4">Amount</TableHead>
                    <TableHead className="h-12 px-4">Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule) => (
                    <TableRow 
                      key={schedule.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/register/${schedule.id}/edit`)}
                    >
                      <TableCell className="py-3 px-4">
                        {schedule.type === 'prepayment' ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            Prepaid Expense
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            Unearned Revenue
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="font-medium">{schedule.vendor}</div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="text-sm text-muted-foreground">
                          {new Date(schedule.invoice_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="text-sm text-muted-foreground">{schedule.reference_number}</div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="text-sm">{getAccountName(schedule.account_id, schedule.type)}</div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="font-medium">
                          {currencySymbol}{Number(schedule.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="text-sm">
                          {new Date(schedule.service_start).toLocaleDateString('en-GB', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })} - {new Date(schedule.service_end).toLocaleDateString('en-GB', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {searchQuery ? (
              <>
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No schedules found</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  No schedules match your search "{searchQuery}". Try adjusting your search terms.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No schedules yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Get started by creating your first prepayment or unearned revenue schedule.
                </p>
                <Link href="/register" className="cursor-pointer">
                  <Button>
                    Go to Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 