import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { ArrowLeft, Eye, Download, Edit } from 'lucide-react'
import { format } from 'date-fns'

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch all schedules for the user
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select(`
      *,
      schedule_entries (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching schedules:', error)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy')
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
              <h1 className="text-2xl font-bold text-gray-900">Schedule Register</h1>
              <p className="text-gray-600">View and manage your saved schedules</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              All Schedules ({schedules?.length || 0})
            </h2>
            <p className="text-gray-600">
              Your saved prepayment and unearned revenue schedules
            </p>
          </div>
          <Link href="/new-schedule">
            <Button>
              Create New Schedule
            </Button>
          </Link>
        </div>

        {schedules && schedules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Saved Schedules</CardTitle>
              <CardDescription>
                Click on any schedule to view details or download the CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Service Period</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Periods</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule: any) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">
                          {schedule.vendor}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            schedule.type === 'prepayment' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {schedule.type === 'prepayment' ? 'Prepayment' : 'Unearned Revenue'}
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
                            <Button variant="ghost" size="sm" disabled>
                              <Edit className="h-4 w-4" />
                            </Button>
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
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No schedules yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first schedule to get started
                </p>
                <Link href="/new-schedule">
                  <Button>
                    Create New Schedule
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
} 