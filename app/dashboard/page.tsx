import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prepaidly</h1>
              <p className="text-gray-600">Prepayment & Unearned Revenue Management</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user.email}</span>
              <form action="/api/auth/logout" method="post">
                <Button variant="outline" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">
            Manage your prepayment and unearned revenue schedules
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Create New Schedule</CardTitle>
              <CardDescription>
                Generate a new prepayment or unearned revenue schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/new-schedule">
                <Button className="w-full">
                  New Schedule
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Register</CardTitle>
              <CardDescription>
                View and manage your saved schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/register">
                <Button variant="outline" className="w-full">
                  View Register
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Generate reports and analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Follow these steps to create your first schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">1</div>
                <div>
                  <h4 className="font-medium">Create a New Schedule</h4>
                  <p className="text-sm text-gray-600">
                    Click the "New Schedule" button to start creating your first prepayment or unearned revenue schedule.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">2</div>
                <div>
                  <h4 className="font-medium">Fill in the Details</h4>
                  <p className="text-sm text-gray-600">
                    Enter vendor information, invoice date, total amount, and service period.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">3</div>
                <div>
                  <h4 className="font-medium">Add to Register</h4>
                  <p className="text-sm text-gray-600">
                    Save the schedule to your register and download it as a CSV file for your records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 