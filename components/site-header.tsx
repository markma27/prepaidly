import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

interface SiteHeaderProps {
  user?: {
    id: string
    email?: string
    user_metadata?: any
  }
  userProfile?: {
    first_name?: string
    last_name?: string
    avatar_url?: string
  } | null
  title?: string
}

export function SiteHeader({ user, userProfile, title }: SiteHeaderProps) {
  // Create display name from profile data if available, otherwise fallback to email
  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`
    }
    if (userProfile?.first_name) {
      return userProfile.first_name
    }
    return user?.email || "User"
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title || "Prepaidly"}</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-block text-sm text-muted-foreground">
            Welcome, {getDisplayName()}
          </span>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <Button variant="outline" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
