'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { Eye, Download, Edit, Search } from 'lucide-react'
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
}

export default function SearchableScheduleTable({ schedules }: SearchableScheduleTableProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
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
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
              <div className="mb-4 text-sm text-gray-600">
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.vendor}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {schedule.reference_number}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          schedule.type === 'prepayment' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {schedule.type === 'prepayment' ? 'Prepaid Expense' : 'Unearned Revenue'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">
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
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Link href={`/register/${schedule.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/register/${schedule.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" disabled>
                            <Download className="h-4 w-4" />
                          </Button>
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
                <div className="rounded-full bg-gray-100 p-3 mb-4">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="font-semibold mb-2">No schedules found</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-sm">
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
                <div className="rounded-full bg-gray-100 p-3 mb-4">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="font-semibold mb-2">No schedules yet</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-sm">
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