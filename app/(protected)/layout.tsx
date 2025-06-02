import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { AppSidebarWrapper } from "@/components/AppSidebarWrapper"
import { DynamicSiteHeaderWrapper } from "@/components/dynamic-site-header-wrapper"
import { EntitySwitchingWrapper } from "@/components/EntitySwitchingWrapper"
import { EntitySwitchingProvider } from "@/components/EntitySwitchingContext"
import { LoadingProvider } from "@/components/LoadingContext"
import { PageTransition } from "@/components/PageTransition"
import { LoadingProgress } from "@/components/LoadingProgress"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <LoadingProvider>
      <EntitySwitchingProvider>
        <LoadingProgress />
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebarWrapper variant="inset" user={user} />
          <SidebarInset>
            <DynamicSiteHeaderWrapper user={user} />
            <EntitySwitchingWrapper>
              <PageTransition>
                {children}
              </PageTransition>
            </EntitySwitchingWrapper>
          </SidebarInset>
        </SidebarProvider>
      </EntitySwitchingProvider>
    </LoadingProvider>
  )
} 