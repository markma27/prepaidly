'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnimatedLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  showLoader?: boolean
  onClick?: () => void
}

export function AnimatedLink({ 
  href, 
  children, 
  className,
  showLoader = true,
  onClick
}: AnimatedLinkProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (onClick) {
      onClick()
    }

    // Show immediate loading feedback
    setIsNavigating(true)

    // Start navigation in a transition
    startTransition(() => {
      router.push(href)
    })

    // Reset loading state after a short delay
    setTimeout(() => {
      setIsNavigating(false)
    }, 500)
  }

  const isLoading = isNavigating || isPending

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "relative transition-all duration-200 ease-in-out",
        "hover:scale-105 active:scale-95",
        isLoading && "pointer-events-none",
        className
      )}
    >
      <div className={cn(
        "transition-all duration-200",
        isLoading ? "opacity-70" : "opacity-100"
      )}>
        {children}
      </div>
      
      {/* Loading indicator */}
      {showLoader && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </Link>
  )
} 