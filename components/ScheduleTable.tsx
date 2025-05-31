'use client'

import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

interface ScheduleTableProps {
  schedule: ScheduleEntry[]
  scheduleType: string
  vendor: string
  totalAmount: number
}

export default function ScheduleTable({ 
  schedule, 
  scheduleType, 
  vendor, 
  totalAmount 
}: ScheduleTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM yyyy')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Preview</CardTitle>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Type:</strong> {scheduleType === 'prepayment' ? 'Prepayment' : 'Unearned Revenue'}</p>
          <p><strong>Vendor:</strong> {vendor}</p>
          <p><strong>Total Amount:</strong> {formatCurrency(totalAmount)}</p>
          <p><strong>Number of Periods:</strong> {schedule.length}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Monthly Amount</TableHead>
                <TableHead className="text-right">Cumulative</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {formatDate(entry.period)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.cumulative)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.remaining)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Summary Row */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center text-sm font-medium">
            <span>Total:</span>
            <span className="font-mono">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 