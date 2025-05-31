import { NextRequest, NextResponse } from 'next/server'
import { ScheduleEntry } from '@/lib/generateStraightLineSchedule'

interface DownloadRequest {
  schedule: ScheduleEntry[]
  formData: {
    type: 'prepayment' | 'unearned'
    vendor: string
    invoiceDate: string
    totalAmount: string
    serviceStart: string
    serviceEnd: string
    description?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schedule, formData }: DownloadRequest = await request.json()

    if (!schedule || !formData) {
      return NextResponse.json(
        { error: 'Missing schedule or form data' },
        { status: 400 }
      )
    }

    // Generate CSV content
    const csvHeaders = [
      'Period',
      'Monthly Amount',
      'Cumulative',
      'Remaining'
    ]

    const csvRows = schedule.map(entry => [
      entry.period,
      entry.amount.toFixed(2),
      entry.cumulative.toFixed(2),
      entry.remaining.toFixed(2)
    ])

    // Create CSV content with metadata
    const csvContent = [
      `# ${formData.type === 'prepayment' ? 'Prepayment' : 'Unearned Revenue'} Schedule`,
      `# Vendor: ${formData.vendor}`,
      `# Invoice Date: ${formData.invoiceDate}`,
      `# Total Amount: $${Number(formData.totalAmount).toFixed(2)}`,
      `# Service Period: ${formData.serviceStart} to ${formData.serviceEnd}`,
      ...(formData.description ? [`# Description: ${formData.description}`] : []),
      '',
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n')

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="schedule-${formData.vendor.replace(/\s+/g, '-').toLowerCase()}-${formData.invoiceDate}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error generating CSV:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSV' },
      { status: 500 }
    )
  }
} 