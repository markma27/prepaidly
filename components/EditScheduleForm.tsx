'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, parseISO, addMonths } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { generateStraightLineSchedule, ScheduleEntry } from '@/lib/generateStraightLineSchedule'

const scheduleSchema = z.object({
  type: z.enum(['prepayment', 'unearned'], {
    required_error: 'Please select a schedule type',
  }),
  referenceNumber: z.string().min(1, 'Reference number is required'),
  vendor: z.string().min(1, 'Vendor name is required'),
  invoiceDate: z.date({
    required_error: 'Invoice date is required',
  }),
  totalAmount: z.string().min(1, 'Total amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Total amount must be a positive number'
  ),
  serviceStart: z.date({
    required_error: 'Service start date is required',
  }),
  serviceEnd: z.date({
    required_error: 'Service end date is required',
  }),
  description: z.string().optional(),
})

type ScheduleFormData = z.infer<typeof scheduleSchema>

interface EditScheduleFormProps {
  initialData: {
    type: 'prepayment' | 'unearned'
    vendor: string
    invoiceDate: string
    totalAmount: string
    serviceStart: string
    serviceEnd: string
    description?: string
    referenceNumber: string
  }
  onScheduleGenerated: (schedule: ScheduleEntry[], formData: {
    type: 'prepayment' | 'unearned'
    referenceNumber: string
    vendor: string
    invoiceDate: string
    totalAmount: string
    serviceStart: string
    serviceEnd: string
    description?: string
  }) => void
}

export default function EditScheduleForm({ initialData, onScheduleGenerated }: EditScheduleFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Local state for date inputs to allow free typing
  const [invoiceDateInput, setInvoiceDateInput] = useState('')
  const [serviceStartInput, setServiceStartInput] = useState('')
  const [serviceEndInput, setServiceEndInput] = useState('')

  // Convert string dates to Date objects for the form
  const convertedInitialData: ScheduleFormData = {
    ...initialData,
    invoiceDate: parseISO(initialData.invoiceDate),
    serviceStart: parseISO(initialData.serviceStart),
    serviceEnd: parseISO(initialData.serviceEnd),
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    control,
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: convertedInitialData,
  })

  const watchedType = watch('type')
  const watchedInvoiceDate = watch('invoiceDate')
  const watchedServiceStart = watch('serviceStart')

  // Helper function to parse date from string with strict validation
  const parseDate = (value: string): Date | null => {
    if (!value.trim()) return null
    
    try {
      let parsedDate: Date | null = null
      
      if (value.match(/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/)) {
        // Format: "15 May 2025" - validate month name is real
        const parts = value.split(/\s+/)
        const day = parseInt(parts[0])
        const monthName = parts[1]
        const year = parseInt(parts[2])
        
        // Check if month name is valid
        const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                           'January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December']
        
        if (!validMonths.some(m => m.toLowerCase().startsWith(monthName.toLowerCase()))) {
          return null
        }
        
        parsedDate = new Date(value)
      } else if (value.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        // Format: "2025-05-15" or "2025-5-15"
        const parts = value.split('-')
        const year = parseInt(parts[0])
        const month = parseInt(parts[1]) - 1
        const day = parseInt(parts[2])
        
        // Validate ranges
        if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
          return null
        }
        
        parsedDate = new Date(year, month, day)
      } else if (value.match(/^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/)) {
        // Format: "15/5/25", "15/05/25", "15/5/2025", "15/05/2025"
        const parts = value.split('/')
        let day = parseInt(parts[0])
        let month = parseInt(parts[1]) - 1 // Month is 0-indexed
        let year = parseInt(parts[2])
        
        // Validate ranges
        if (month < 0 || month > 11 || day < 1 || day > 31) {
          return null
        }
        
        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year += year < 50 ? 2000 : 1900 // 00-49 = 2000-2049, 50-99 = 1950-1999
        }
        
        if (year < 1900 || year > 2100) {
          return null
        }
        
        parsedDate = new Date(year, month, day)
      } else {
        // Reject invalid formats - no fallback parsing
        return null
      }
      
      // Final validation: check if the constructed date is valid and matches input
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        return null
      }
      
      // Additional check: ensure the date components match what was input
      // This catches cases like Feb 30 which creates a valid Date but wrong month
      if (value.match(/^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/)) {
        const parts = value.split('/')
        const inputDay = parseInt(parts[0])
        const inputMonth = parseInt(parts[1])
        
        if (parsedDate.getDate() !== inputDay || (parsedDate.getMonth() + 1) !== inputMonth) {
          return null
        }
      }
      
      return parsedDate
    } catch {
      return null
    }
  }

  // Reset form with initial data when it changes
  useEffect(() => {
    const convertedData: ScheduleFormData = {
      ...initialData,
      invoiceDate: parseISO(initialData.invoiceDate),
      serviceStart: parseISO(initialData.serviceStart),
      serviceEnd: parseISO(initialData.serviceEnd),
    }
    reset(convertedData)
    
    // Update input states with formatted dates
    setInvoiceDateInput(format(parseISO(initialData.invoiceDate), 'dd MMM yyyy'))
    setServiceStartInput(format(parseISO(initialData.serviceStart), 'dd MMM yyyy'))
    setServiceEndInput(format(parseISO(initialData.serviceEnd), 'dd MMM yyyy'))
  }, [initialData, reset])

  // Set the initial type value for the select component
  useEffect(() => {
    if (initialData.type) {
      setValue('type', initialData.type)
    }
  }, [initialData.type, setValue])

  const onSubmit = async (data: ScheduleFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const serviceStart = data.serviceStart
      const serviceEnd = data.serviceEnd
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

      // Convert dates to strings for the API
      const formDataForAPI = {
        ...data,
        invoiceDate: format(data.invoiceDate, 'yyyy-MM-dd'),
        serviceStart: format(data.serviceStart, 'yyyy-MM-dd'),
        serviceEnd: format(data.serviceEnd, 'yyyy-MM-dd'),
      }

      onScheduleGenerated(schedule, formDataForAPI)
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the schedule')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Schedule Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Schedule Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={watchedType === 'prepayment' ? 'default' : 'outline'}
                onClick={() => setValue('type', 'prepayment')}
                className={`h-auto p-4 justify-start ${
                  watchedType === 'prepayment' 
                    ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' 
                    : 'hover:bg-blue-50 hover:border-blue-200'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium">Prepaid Expense</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Expenses paid in advance
                  </div>
                </div>
              </Button>
              <Button
                type="button"
                variant={watchedType === 'unearned' ? 'default' : 'outline'}
                onClick={() => setValue('type', 'unearned')}
                className={`h-auto p-4 justify-start ${
                  watchedType === 'unearned' 
                    ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' 
                    : 'hover:bg-green-50 hover:border-green-200'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium">Unearned Revenue</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Revenue received in advance
                  </div>
                </div>
              </Button>
            </div>
            {errors.type && (
              <p className="text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Reference Number</Label>
            <Input
              id="referenceNumber"
              {...register('referenceNumber')}
              placeholder="Enter reference number (e.g., INV-2024-001)"
            />
            {errors.referenceNumber && (
              <p className="text-sm text-red-600">{errors.referenceNumber.message}</p>
            )}
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label htmlFor="vendor">Contact</Label>
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
            <Label>Invoice Date</Label>
            <Controller
              name="invoiceDate"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Input
                    placeholder="Enter date (e.g., 15 May 2025)"
                    value={invoiceDateInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setInvoiceDateInput(value)
                      
                      // Try to parse and update the form field
                      const parsedDate = parseDate(value)
                      if (parsedDate) {
                        field.onChange(parsedDate)
                      } else if (!value.trim()) {
                        field.onChange(undefined)
                      }
                    }}
                    onBlur={() => {
                      // On blur, format the date if valid
                      const parsedDate = parseDate(invoiceDateInput)
                      if (parsedDate) {
                        setInvoiceDateInput(format(parsedDate, 'dd MMM yyyy'))
                      }
                    }}
                    className="pr-10"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                          if (date) {
                            setInvoiceDateInput(format(date, 'dd MMM yyyy'))
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
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
            <Label>Service Start Date</Label>
            <Controller
              name="serviceStart"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Input
                    placeholder="Enter date (e.g., 16 May 2025)"
                    value={serviceStartInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setServiceStartInput(value)
                      
                      // Try to parse and update the form field
                      const parsedDate = parseDate(value)
                      if (parsedDate) {
                        field.onChange(parsedDate)
                      } else if (!value.trim()) {
                        field.onChange(undefined)
                      }
                    }}
                    onBlur={() => {
                      // On blur, format the date if valid
                      const parsedDate = parseDate(serviceStartInput)
                      if (parsedDate) {
                        setServiceStartInput(format(parsedDate, 'dd MMM yyyy'))
                      }
                    }}
                    className="pr-10"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                          if (date) {
                            setServiceStartInput(format(date, 'dd MMM yyyy'))
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            />
            {errors.serviceStart && (
              <p className="text-sm text-red-600">{errors.serviceStart.message}</p>
            )}
          </div>

          {/* Service End Date */}
          <div className="space-y-2">
            <Label>Service End Date</Label>
            <Controller
              name="serviceEnd"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Input
                    placeholder="Enter date or +12 for 12 months from invoice date"
                    value={serviceEndInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setServiceEndInput(value)
                      
                      // Handle regular date input (but skip shortcuts)
                      const isShortcut = value.match(/^\+\d/)
                      if (!isShortcut) {
                        const parsedDate = parseDate(value)
                        if (parsedDate) {
                          field.onChange(parsedDate)
                        } else if (!value.trim()) {
                          field.onChange(undefined)
                        }
                      }
                    }}
                    onBlur={() => {
                      // Check for shortcut pattern (+number) on blur
                      const shortcutMatch = serviceEndInput.match(/^\+(\d+)$/)
                      if (shortcutMatch) {
                        const months = parseInt(shortcutMatch[1])
                        console.log('Shortcut detected on blur:', serviceEndInput, 'months:', months)
                        
                        // Try to get service start date from form or parse from input
                        let serviceStartDate: Date | null = watchedServiceStart
                        if (!serviceStartDate && serviceStartInput) {
                          serviceStartDate = parseDate(serviceStartInput)
                        }
                        
                        console.log('Service start date:', serviceStartDate)
                        
                        if (serviceStartDate) {
                          // Calculate end date as (service start date + months - 1 day)
                          const endDate = addMonths(serviceStartDate, months)
                          endDate.setDate(endDate.getDate() - 1)
                          field.onChange(endDate)
                          setServiceEndInput(format(endDate, 'dd MMM yyyy'))
                          console.log('End date calculated:', format(endDate, 'dd MMM yyyy'))
                          return
                        }
                      }
                      
                      // On blur, format the date if valid (for regular dates)
                      const parsedDate = parseDate(serviceEndInput)
                      if (parsedDate) {
                        setServiceEndInput(format(parsedDate, 'dd MMM yyyy'))
                      }
                    }}
                    className="pr-10"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                          if (date) {
                            setServiceEndInput(format(date, 'dd MMM yyyy'))
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            />
            {errors.serviceEnd && (
              <p className="text-sm text-red-600">{errors.serviceEnd.message}</p>
            )}
            <p className="text-xs text-gray-500">
              Tip: Type "+12" for 12 months from service start date, then press Tab or click away
            </p>
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
            {isLoading ? 'Regenerating Schedule...' : 'Regenerate Schedule'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 