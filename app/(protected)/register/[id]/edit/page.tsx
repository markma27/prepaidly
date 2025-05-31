'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, Check } from 'lucide-react'
import EditScheduleForm from '@/components/EditScheduleForm'
import ScheduleTable from '@/components/ScheduleTable'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'

type ScheduleFormData = {
  type: 'prepayment' | 'unearned'
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
        const initialFormData: ScheduleFormData = {
          type: scheduleData.type,
          vendor: scheduleData.vendor,
          invoiceDate: scheduleData.invoice_date,
          totalAmount: scheduleData.total_amount.toString(),
          serviceStart: scheduleData.service_start,
          serviceEnd: scheduleData.service_end,
          description: scheduleData.description || '',
          referenceNumber: scheduleData.reference_number,
        }
        
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

  const handleScheduleGenerated = (newSchedule: ScheduleEntry[], newFormData: ScheduleFormData) => {
    setSchedule(newSchedule)
    setFormData(newFormData)
    setSaveStatus('idle')
  }

  const handleUpdateSchedule = async () => {
    if (!schedule || !formData) return

    setIsSaving(true)
    setSaveStatus('idle')
    
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule,
          formData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update schedule')
      }

      setSaveStatus('success')
      setSaveMessage(result.message || 'Schedule successfully updated')
      
      // Auto-hide success message and redirect after 2 seconds
      setTimeout(() => {
        router.push('/register')
      }, 2000)

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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href="/register">
                <Button className="gap-2 bg-black text-white hover:bg-gray-800">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Register
                </Button>
              </Link>
              <div className="ml-8">
                <h1 className="text-2xl font-bold text-gray-900">Loading Schedule...</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!originalData || !formData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href="/register">
                <Button className="gap-2 bg-black text-white hover:bg-gray-800">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Register
                </Button>
              </Link>
              <div className="ml-8">
                <h1 className="text-2xl font-bold text-gray-900">Schedule Not Found</h1>
              </div>
            </div>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/register">
              <Button className="gap-2 bg-black text-white hover:bg-gray-800">
                <ArrowLeft className="h-4 w-4" />
                Back to Register
              </Button>
            </Link>
            <div className="ml-8">
              <h1 className="text-2xl font-bold text-gray-900">Edit Schedule</h1>
              <p className="text-gray-600">Modify your {formData.type} schedule for {formData.vendor}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column */}
          <div>
            <EditScheduleForm 
              initialData={formData}
              onScheduleGenerated={handleScheduleGenerated} 
            />
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
                />
                
                {/* Update Button */}
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
                        Updating...
                      </>
                    ) : saveStatus === 'success' ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Updated! Redirecting...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Update Schedule
                      </>
                    )}
                  </Button>
                </div>

                {/* Save Status Messages */}
                {saveStatus === 'success' && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                    <div className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      {saveMessage}
                    </div>
                  </div>
                )}

                {saveStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                    <div className="flex items-center">
                      <span className="h-4 w-4 mr-2">⚠️</span>
                      {saveMessage}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
                <div className="text-center text-gray-500">
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