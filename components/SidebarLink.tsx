'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SidebarLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function SidebarLink({ 
  href, 
  children, 
  className,
  onClick
}: SidebarLinkProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (onClick) {
      onClick()
    }

    // Show subtle feedback
    setIsNavigating(true)

    // Start navigation in a transition
    startTransition(() => {
      router.push(href)
    })

    // Reset state
    setTimeout(() => {
      setIsNavigating(false)
    }, 300)
  }

  const isLoading = isNavigating || isPending

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "transition-opacity duration-150 ease-in-out",
        isLoading ? "opacity-70" : "opacity-100",
        className
      )}
    >
      {children}
    </Link>
  )
} 