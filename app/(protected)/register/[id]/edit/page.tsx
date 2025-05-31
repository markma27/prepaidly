'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, Check } from 'lucide-react'
import EditScheduleForm from '@/components/EditScheduleForm'
import ScheduleTable from '@/components/ScheduleTable'
import { ScheduleEntry, generateStraightLineSchedule } from '@/lib/generateStraightLineSchedule'

type ScheduleFormData = {
  type: 'prepayment' | 'unearned'
  accountId: string
  vendor: string
  invoiceDate: string
  totalAmount: string
  serviceStart: string
  serviceEnd: string
  description?: string
  referenceNumber: string
}

type ScheduleData = {
  id: string
  type: 'prepayment' | 'unearned'
  vendor: string
  invoice_date: string
  total_amount: number
  service_start: string
  service_end: string
  description?: string
  reference_number: string
  account_id?: string
  schedule_entries: ScheduleEntry[]
}

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const scheduleId = params.id as string

  const [originalData, setOriginalData] = useState<ScheduleData | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null)
  const [formData, setFormData] = useState<ScheduleFormData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [currency, setCurrency] = useState('USD')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [userAccounts, setUserAccounts] = useState<{
    prepaid_accounts: any[]
    unearned_accounts: any[]
  }>({ prepaid_accounts: [], unearned_accounts: [] })

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const response = await fetch('/api/settings')
        if (response.ok) {
          const result = await response.json()
          const settings = result.settings
          
          // Set currency
          const userCurrency = settings?.currency || 'USD'
          setCurrency(userCurrency)
          
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
          setCurrencySymbol(currencySymbols[userCurrency] || '$')
          
          // Set accounts
          if (settings) {
            setUserAccounts({
              prepaid_accounts: settings.prepaid_accounts || [],
              unearned_accounts: settings.unearned_accounts || []
            })
          }
        }
      } catch (error) {
        console.error('Error fetching user settings:', error)
      }
    }

    fetchUserSettings()
  }, [])

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(`/api/schedules/${scheduleId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch schedule')
        }
        
        const result = await response.json()
        const scheduleData = result.schedule
        
        setOriginalData(scheduleData)
        
        // Convert the database data to form format
        console.log('Loaded schedule data:', scheduleData)
        console.log('Account ID from database:', scheduleData.account_id)
        
        const initialFormData: ScheduleFormData = {
          type: scheduleData.type,
          accountId: scheduleData.account_id || '',
          vendor: scheduleData.vendor,
          invoiceDate: scheduleData.invoice_date,
          totalAmount: scheduleData.total_amount.toString(),
          serviceStart: scheduleData.service_start,
          serviceEnd: scheduleData.service_end,
          description: scheduleData.description || '',
          referenceNumber: scheduleData.reference_number,
        }
        
        console.log('Initial form data:', initialFormData)
        
        setFormData(initialFormData)
        
        // Set initial schedule entries
        if (scheduleData.schedule_entries) {
          setSchedule(scheduleData.schedule_entries)
        }
        
      } catch (error) {
        console.error('Error fetching schedule:', error)
        // Redirect back to register if schedule not found
        router.push('/register')
      } finally {
        setIsLoading(false)
      }
    }

    if (scheduleId) {
      fetchSchedule()
    }
  }, [scheduleId, router])

  // Store form methods
  const [formMethods, setFormMethods] = useState<{
    getCurrentFormData: () => any
    validateForm: () => Promise<boolean>
    getFormErrors: () => any
  } | null>(null)

  const handleUpdateSchedule = async () => {
    if (!formMethods) {
      setSaveStatus('error')
      setSaveMessage('Form not ready. Please try again.')
      return
    }

    setIsSaving(true)
    setSaveStatus('idle')
    
    try {
      // First validate the form
      const isValid = await formMethods.validateForm()
      if (!isValid) {
        const errors = formMethods.getFormErrors()
        console.log('Form validation failed:', errors)
        setSaveStatus('error')
        setSaveMessage('Please fix the form errors and try again.')
        return
      }

      // Get current form data
      const currentFormData = formMethods.getCurrentFormData()
      console.log('Current form data:', currentFormData)
      console.log('Account ID being saved:', currentFormData.accountId)

      // Validate date range
      const serviceStart = new Date(currentFormData.serviceStart)
      const serviceEnd = new Date(currentFormData.serviceEnd)
      const totalAmount = Number(currentFormData.totalAmount)

      if (serviceStart >= serviceEnd) {
        throw new Error('Service start date must be before service end date')
      }

      // Generate the schedule
      const newSchedule = generateStraightLineSchedule({
        serviceStart,
        serviceEnd,
        totalAmount,
      })

      console.log('Generated schedule:', newSchedule)

      // Update the preview
      setSchedule(newSchedule)
      setFormData(currentFormData)

      // Save to database
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule: newSchedule,
          formData: currentFormData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update schedule')
      }

      setSaveStatus('success')
      setSaveMessage(result.message || 'Schedule successfully updated')

    } catch (error: any) {
      console.error('Error updating schedule:', error)
      setSaveStatus('error')
      setSaveMessage(error.message || 'Failed to update schedule. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href="/register">
                <Button className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Register
                </Button>
              </Link>
              <div className="ml-8">
                <h1 className="text-2xl font-bold text-foreground">Loading Schedule...</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!originalData || !formData) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href="/register">
                <Button className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Register
                </Button>
              </Link>
              <div className="ml-8">
                <h1 className="text-2xl font-bold text-foreground">Schedule Not Found</h1>
              </div>
            </div>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/register">
              <Button className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                <ArrowLeft className="h-4 w-4" />
                Back to Register
              </Button>
            </Link>
            <div className="ml-8">
              <h1 className="text-2xl font-bold text-foreground">Edit Schedule</h1>
              <p className="text-muted-foreground">Modify your {formData.type} schedule for {formData.vendor}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column */}
          <div className="space-y-6">
            <EditScheduleForm 
              initialData={formData}
              currency={currency}
              currencySymbol={currencySymbol}
              userAccounts={userAccounts}
              onFormReady={setFormMethods}
            />
            
            {/* Generate Schedule and Save Button */}
            <div className="flex justify-center">
              <Button 
                onClick={handleUpdateSchedule}
                disabled={isSaving || saveStatus === 'success'}
                className="w-full sm:w-auto"
                variant={saveStatus === 'success' ? 'default' : 'default'}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating and Saving...
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved Successfully!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Generate Schedule and Save
                  </>
                )}
              </Button>
            </div>

            {/* Save Status Messages */}
            {saveStatus === 'success' && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md">
                <div className="flex items-center">
                  <Check className="h-4 w-4 mr-2" />
                  {saveMessage}
                </div>
              </div>
            )}

            {saveStatus === 'error' && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
                <div className="flex items-center">
                  <span className="h-4 w-4 mr-2">⚠️</span>
                  {saveMessage}
                </div>
              </div>
            )}
          </div>

          {/* Preview Column */}
          <div>
            {schedule && formData ? (
              <ScheduleTable
                schedule={schedule}
                scheduleType={formData.type}
                vendor={formData.vendor}
                totalAmount={Number(formData.totalAmount)}
                currency={currency}
                currencySymbol={currencySymbol}
              />
            ) : (
              <div className="flex items-center justify-center h-64 bg-card rounded-lg border">
                <div className="text-center text-muted-foreground">
                  <div className="text-lg font-medium mb-2">Schedule Preview</div>
                  <div className="text-sm">
                    Update the form to regenerate the schedule preview
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 