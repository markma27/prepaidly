import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch user's schedules for dashboard metrics
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', user.id)

  // Get recent schedules for data table
  const recentSchedules = schedules?.slice(0, 10) || []

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset>
        <SiteHeader user={user} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards schedules={schedules || []} />
              <ChartAreaInteractive schedules={schedules || []} />
              <DataTable data={recentSchedules} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
