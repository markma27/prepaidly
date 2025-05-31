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
  title?: string
}

export function SiteHeader({ user, title }: SiteHeaderProps) {
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
            Welcome, {user?.email}
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
