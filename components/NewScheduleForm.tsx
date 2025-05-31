'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { generateStraightLineSchedule, ScheduleEntry } from '@/lib/generateStraightLineSchedule'

const scheduleSchema = z.object({
  type: z.enum(['prepayment', 'unearned'], {
    required_error: 'Please select a schedule type',
  }),
  vendor: z.string().min(1, 'Vendor name is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  totalAmount: z.string().min(1, 'Total amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Total amount must be a positive number'
  ),
  serviceStart: z.string().min(1, 'Service start date is required'),
  serviceEnd: z.string().min(1, 'Service end date is required'),
  description: z.string().optional(),
})

type ScheduleFormData = z.infer<typeof scheduleSchema>

interface NewScheduleFormProps {
  onScheduleGenerated: (schedule: ScheduleEntry[], formData: ScheduleFormData) => void
}

export default function NewScheduleForm({ onScheduleGenerated }: NewScheduleFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
  })

  const watchedType = watch('type')

  const onSubmit = async (data: ScheduleFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const serviceStart = new Date(data.serviceStart)
      const serviceEnd = new Date(data.serviceEnd)
      const totalAmount = Number(data.totalAmount)

      // Validate date range
      if (serviceStart >= serviceEnd) {
        throw new Error('Service start date must be before service end date')
      }

      // Generate the schedule
      const schedule = generateStraightLineSchedule({
        serviceStart,
        serviceEnd,
        totalAmount,
      })

      onScheduleGenerated(schedule, data)
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the schedule')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Schedule Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Schedule Type</Label>
            <Select onValueChange={(value) => setValue('type', value as 'prepayment' | 'unearned')}>
              <SelectTrigger>
                <SelectValue placeholder="Select schedule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prepayment">Prepayment</SelectItem>
                <SelectItem value="unearned">Unearned Revenue</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor/Company</Label>
            <Input
              id="vendor"
              {...register('vendor')}
              placeholder="Enter vendor or company name"
            />
            {errors.vendor && (
              <p className="text-sm text-red-600">{errors.vendor.message}</p>
            )}
          </div>

          {/* Invoice Date */}
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input
              id="invoiceDate"
              type="date"
              {...register('invoiceDate')}
            />
            {errors.invoiceDate && (
              <p className="text-sm text-red-600">{errors.invoiceDate.message}</p>
            )}
          </div>

          {/* Total Amount */}
          <div className="space-y-2">
            <Label htmlFor="totalAmount">Total Amount ($)</Label>
            <Input
              id="totalAmount"
              type="number"
              step="0.01"
              min="0"
              {...register('totalAmount')}
              placeholder="Enter total amount"
            />
            {errors.totalAmount && (
              <p className="text-sm text-red-600">{errors.totalAmount.message}</p>
            )}
          </div>

          {/* Service Start Date */}
          <div className="space-y-2">
            <Label htmlFor="serviceStart">Service Start Date</Label>
            <Input
              id="serviceStart"
              type="date"
              {...register('serviceStart')}
            />
            {errors.serviceStart && (
              <p className="text-sm text-red-600">{errors.serviceStart.message}</p>
            )}
          </div>

          {/* Service End Date */}
          <div className="space-y-2">
            <Label htmlFor="serviceEnd">Service End Date</Label>
            <Input
              id="serviceEnd"
              type="date"
              {...register('serviceEnd')}
            />
            {errors.serviceEnd && (
              <p className="text-sm text-red-600">{errors.serviceEnd.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Enter a description for this schedule"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Generating Schedule...' : 'Generate Schedule'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 