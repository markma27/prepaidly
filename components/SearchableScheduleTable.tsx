'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  created_at: string
  schedule_entries?: any[]
}

interface SearchableScheduleTableProps {
  schedules: Schedule[]
  currency?: string
  currencySymbol?: string
}

export default function SearchableScheduleTable({ schedules, currency = 'USD', currencySymbol = '$' }: SearchableScheduleTableProps) {
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

  // Filter schedules based on search query
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) {
      return schedules
    }

    const query = searchQuery.toLowerCase().trim()
    
    return schedules.filter((schedule) => {
      // Search by contact name (vendor)
      const matchesContact = schedule.vendor.toLowerCase().includes(query)
      
      // Search by reference number
      const matchesReference = schedule.reference_number.toLowerCase().includes(query)
      
      // Search by type
      const typeDisplay = schedule.type === 'prepayment' ? 'prepaid expense' : 'unearned revenue'
      const matchesType = typeDisplay.includes(query) || schedule.type.includes(query)
      
      // Search by amount (both formatted and raw)
      const formattedAmount = formatCurrency(schedule.total_amount).toLowerCase()
      const rawAmount = schedule.total_amount.toString()
      const matchesAmount = formattedAmount.includes(query) || rawAmount.includes(query)
      
      return matchesContact || matchesReference || matchesType || matchesAmount
    })
  }, [schedules, searchQuery])

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
              placeholder="Search by contact, reference, type, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredSchedules.length > 0 ? (
          <>
            {searchQuery && (
              <div className="mb-4 text-sm text-muted-foreground">
                Found {filteredSchedules.length} of {schedules.length} schedules
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Service Period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Periods</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule) => (
                    <TableRow 
                      key={schedule.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/register/${schedule.id}/edit`)}
                    >
                      <TableCell className="font-medium">
                        {schedule.vendor}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {schedule.reference_number}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          schedule.type === 'prepayment' 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                            : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        }`}>
                          {schedule.type === 'prepayment' ? 'Prepaid Expense' : 'Unearned Revenue'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(schedule.total_amount))}
                      </TableCell>
                      <TableCell>
                        {formatDate(schedule.service_start)} - {formatDate(schedule.service_end)}
                      </TableCell>
                      <TableCell>
                        {formatDate(schedule.created_at)}
                      </TableCell>
                      <TableCell>
                        {schedule.schedule_entries?.length || 0} months
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
                <Link href="/new-schedule">
                  <Button>
                    Create First Schedule
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