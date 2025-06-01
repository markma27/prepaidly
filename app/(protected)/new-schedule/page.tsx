'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NewScheduleForm from '@/components/NewScheduleForm'
import ScheduleTable from '@/components/ScheduleTable'
import AuditTrail from '@/components/AuditTrail'
import { ScheduleEntry, generateStraightLineSchedule } from '@/lib/generateStraightLineSchedule'
import { Button } from '@/components/ui/button'
import { Download, Save, Check } from 'lucide-react'


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

export default function NewSchedulePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Entity handling
  const [currentEntityId, setCurrentEntityId] = useState<string>('')
  const [currentEntityName, setCurrentEntityName] = useState<string>('')
  const [isLoadingEntity, setIsLoadingEntity] = useState(true)
  
  const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null)
  const [formData, setFormData] = useState<ScheduleFormData | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [createdScheduleId, setCreatedScheduleId] = useState<string | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [userAccounts, setUserAccounts] = useState<{
    prepaid_accounts: any[]
    unearned_accounts: any[]
  }>({ prepaid_accounts: [], unearned_accounts: [] })
  
  // Store form methods
  const [formMethods, setFormMethods] = useState<{
    getCurrentFormData: () => any
    validateForm: () => Promise<boolean>
    getFormErrors: () => any
  } | null>(null)

  // Store last saved form data to detect changes
  const [lastSavedFormData, setLastSavedFormData] = useState<ScheduleFormData | null>(null)



  // Initialize entity from URL params or localStorage
  useEffect(() => {
    let entityId = searchParams.get('entity')
    
    if (!entityId) {
      // Try localStorage as fallback
      entityId = localStorage.getItem('selectedEntityId')
      if (entityId) {
        // Update URL to include entity
        const params = new URLSearchParams(searchParams)
        params.set('entity', entityId)
        router.replace(`/new-schedule?${params.toString()}`)
      } else {
        // Default to Demo Company
        entityId = '00000000-0000-0000-0000-000000000001'
        const params = new URLSearchParams(searchParams)
        params.set('entity', entityId)
        router.replace(`/new-schedule?${params.toString()}`)
      }
    }
    
    setCurrentEntityId(entityId)
    localStorage.setItem('selectedEntityId', entityId)
    
    // Fetch entity name
    fetchEntityName(entityId)
    setIsLoadingEntity(false)
  }, [searchParams, router])

  // Fetch entity name for display
  const fetchEntityName = async (entityId: string) => {
    try {
      const response = await fetch('/api/entities')
      if (response.ok) {
        const result = await response.json()
        const entity = result.entities?.find((e: any) => e.id === entityId)
        if (entity) {
          setCurrentEntityName(entity.name)
        }
      }
    } catch (error) {
      console.error('Error fetching entity name:', error)
    }
  }

  // Reset save status when form data changes after successful save
  useEffect(() => {
    if (saveStatus === 'success' && formMethods && lastSavedFormData) {
      const checkForChanges = () => {
        try {
          const currentFormData = formMethods.getCurrentFormData()
          
          // Compare current form data with last saved data
          const hasChanges = (Object.keys(currentFormData) as (keyof ScheduleFormData)[]).some(key => {
            return currentFormData[key] !== lastSavedFormData[key]
          })
          
          if (hasChanges) {
            setSaveStatus('idle')
            setSaveMessage('')
          }
        } catch (error) {
          // Ignore errors during form data retrieval
        }
      }

      // Check for changes every 500ms
      const interval = setInterval(checkForChanges, 500)
      
      return () => clearInterval(interval)
    }
  }, [formMethods, saveStatus, lastSavedFormData])

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        // Get current entity from URL
        const urlParams = new URLSearchParams(window.location.search)
        const entityId = urlParams.get('entity') || '00000000-0000-0000-0000-000000000001'
        
        const response = await fetch(`/api/settings?entity=${entityId}`)
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

  const handleGenerateAndSave = async () => {
    if (!formMethods) {
      setSaveStatus('error')
      setSaveMessage('Form not ready. Please try again.')
      return
    }

    if (!currentEntityId) {
      setSaveStatus('error')
      setSaveMessage('No entity selected. Please select an entity.')
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

      // Save to database with entity ID
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule: newSchedule,
          formData: currentFormData,
          entityId: currentEntityId, // Include entity ID in request
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save schedule')
      }

      setSaveStatus('success')
      setSaveMessage(result.message || 'Schedule successfully added to register')
      
      // Store the created schedule ID for audit trail
      if (result.schedule && result.schedule.id) {
        setCreatedScheduleId(result.schedule.id)
      }
      
      // Store the saved form data for change detection
      setLastSavedFormData(currentFormData)

    } catch (error: any) {
      console.error('Error generating and saving schedule:', error)
      setSaveStatus('error')
      setSaveMessage(error.message || 'Failed to save schedule. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadCSV = async () => {
    if (!schedule || !formData) return

    setIsDownloading(true)
    
    try {
      const response = await fetch('/api/download-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule,
          formData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate CSV')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule-${formData.vendor.replace(/\s+/g, '-').toLowerCase()}-${formData.invoiceDate}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      // Log CSV download audit entry
      if (createdScheduleId) {
        await fetch('/api/audit/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: createdScheduleId,
            action: 'CSV Downloaded',
            actionType: 'downloaded',
            details: `Schedule CSV downloaded for ${formData.vendor}`
          })
        })
      }
    } catch (error) {
      console.error('Error downloading CSV:', error)
      alert('Failed to download CSV. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Create New Schedule</h1>
          <p className="text-muted-foreground">Generate a prepayment or unearned revenue schedule</p>
          {currentEntityName && (
            <div className="mt-2 flex items-center text-sm text-muted-foreground">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {currentEntityName}
              </span>
              <span className="ml-2">Schedule will be created for this entity</span>
            </div>
          )}
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column */}
          <div className="space-y-6">
            <NewScheduleForm 
              currency={currency}
              currencySymbol={currencySymbol}
              userAccounts={userAccounts}
              onFormReady={setFormMethods}
            />
            
            {/* Generate Schedule and Save Button */}
            <div className="flex justify-center">
              <Button 
                onClick={handleGenerateAndSave}
                disabled={isSaving || saveStatus === 'success'}
                className="w-full sm:w-auto cursor-pointer"
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
              <div className="space-y-6">
                <ScheduleTable
                  schedule={schedule}
                  scheduleType={formData.type}
                  vendor={formData.vendor}
                  totalAmount={Number(formData.totalAmount)}
                  currency={currency}
                  currencySymbol={currencySymbol}
                />
                
                {/* Download CSV Button */}
                {saveStatus === 'success' && (
                  <div className="flex justify-center">
                    <Button 
                      onClick={handleDownloadCSV}
                      disabled={isDownloading}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isDownloading ? 'Generating CSV...' : 'Download CSV'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-white dark:bg-card rounded-lg border">
                <div className="text-center">
                  <div className="text-lg font-medium mb-2 text-foreground/90">Schedule Preview</div>
                  <div className="text-sm text-foreground/70 dark:text-foreground/80">
                    Fill out the form to generate and preview your schedule
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Audit Trail Section - Only show after successful creation */}
        {createdScheduleId && (
          <AuditTrail 
            scheduleId={createdScheduleId} 
            isVisible={saveStatus === 'success'}
          />
        )}
      </div>
    </div>
  )
} 