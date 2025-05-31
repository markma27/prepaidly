'use client'

import { useState } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewScheduleForm from '@/components/NewScheduleForm'
import ScheduleTable from '@/components/ScheduleTable'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Save, Check } from 'lucide-react'

type ScheduleFormData = {
  type: 'prepayment' | 'unearned'
  vendor: string
  invoiceDate: string
  totalAmount: string
  serviceStart: string
  serviceEnd: string
  description?: string
}

export default function NewSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null)
  const [formData, setFormData] = useState<ScheduleFormData | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  const handleScheduleGenerated = (newSchedule: ScheduleEntry[], newFormData: ScheduleFormData) => {
    setSchedule(newSchedule)
    setFormData(newFormData)
    setSaveStatus('idle') // Reset save status when new schedule is generated
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
    } catch (error) {
      console.error('Error downloading CSV:', error)
      alert('Failed to download CSV. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleAddToRegister = async () => {
    if (!schedule || !formData) return

    setIsSaving(true)
    setSaveStatus('idle')
    
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
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
        throw new Error(result.error || 'Failed to save schedule')
      }

      setSaveStatus('success')
      setSaveMessage(result.message || 'Schedule successfully added to register')
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)

    } catch (error: any) {
      console.error('Error saving schedule:', error)
      setSaveStatus('error')
      setSaveMessage(error.message || 'Failed to save schedule. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/dashboard" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Schedule</h1>
              <p className="text-gray-600">Generate a prepayment or unearned revenue schedule</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column */}
          <div>
            <NewScheduleForm onScheduleGenerated={handleScheduleGenerated} />
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
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleAddToRegister}
                    disabled={isSaving || saveStatus === 'success'}
                    className="flex-1 sm:flex-none"
                    variant={saveStatus === 'success' ? 'default' : 'default'}
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : saveStatus === 'success' ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Added to Register
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Add to Register
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleDownloadCSV}
                    disabled={isDownloading}
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isDownloading ? 'Generating CSV...' : 'Download CSV'}
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
                    Fill out the form to generate and preview your schedule
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