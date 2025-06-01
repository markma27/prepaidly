'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Building2, ChevronDown, Search, Plus, Settings, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEntitySwitching } from './EntitySwitchingContext'

interface Entity {
  id: string
  name: string
  slug: string
  description?: string
  is_demo: boolean
  role: string
}

interface SidebarEntitySelectorProps {
  currentEntityId?: string
}

export default function SidebarEntitySelector({ 
  currentEntityId
}: SidebarEntitySelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isEntitySwitching, switchEntity } = useEntitySwitching()
  const [entities, setEntities] = useState<Entity[]>([])
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchUserEntities()
  }, [])

  // Add a window focus listener to refresh entities when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      fetchUserEntities()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  useEffect(() => {
    if (currentEntityId && entities.length > 0) {
      const entity = entities.find(e => e.id === currentEntityId)
      if (entity) {
        setCurrentEntity(entity)
      }
    }
  }, [currentEntityId, entities])

  const fetchUserEntities = async () => {
    try {
      const response = await fetch('/api/entities')
      if (response.ok) {
        const result = await response.json()
        setEntities(result.entities || [])
        
        // If current entity is provided, find and set it
        if (currentEntityId && result.entities?.length > 0) {
          const entity = result.entities.find((e: Entity) => e.id === currentEntityId)
          if (entity) {
            setCurrentEntity(entity)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching entities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEntityChange = (entityId: string) => {
    // Don't proceed if it's the same entity
    if (entityId === currentEntity?.id) {
      setIsOpen(false)
      return
    }
    
    setIsOpen(false)
    setSearchQuery('')
    
    // Use context to switch entity
    switchEntity(entityId)
  }

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getEntityInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getEntityColor = (entity: Entity) => {
    if (entity.is_demo) return 'bg-blue-500'
    
    // Generate consistent color based on entity name
    const colors = [
      'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 
      'bg-indigo-500', 'bg-pink-500', 'bg-yellow-500', 'bg-teal-500'
    ]
    const hash = entity.name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b">
        <div className="flex items-center space-x-3 animate-pulse p-2">
          <div className="w-8 h-8 bg-muted rounded-md"></div>
          <div className="flex-1">
            <div className="h-3 bg-muted rounded w-24 mb-1"></div>
            <div className="h-2 bg-muted rounded w-16"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentEntity && entities.length === 0) {
    return (
      <div className="px-3 py-2 border-b">
        <div className="flex items-center space-x-3 text-muted-foreground p-2">
          <Building2 className="h-4 w-4" />
          <span className="text-sm">No organisations</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 border-b">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            disabled={isEntitySwitching}
            className={cn(
              "w-full justify-start p-2 h-auto hover:bg-accent/50",
              "focus-visible:ring-1 focus-visible:ring-ring",
              "transition-all duration-200"
            )}
          >
            <div className="flex items-center space-x-3 w-full">
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-semibold transition-all duration-200",
                currentEntity ? getEntityColor(currentEntity) : 'bg-muted'
              )}>
                {isEntitySwitching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  currentEntity ? getEntityInitials(currentEntity.name) : '?'
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-foreground flex items-center gap-2">
                  <span className="transition-all duration-200">
                    {isEntitySwitching 
                      ? 'Switching...' 
                      : currentEntity?.name || 'Select Organisation'
                    }
                  </span>
                  {currentEntity?.is_demo && !isEntitySwitching && (
                    <Badge variant="secondary" className="text-xs h-4 px-1.5 bg-blue-100 text-blue-700 border-blue-200 transition-opacity duration-200">
                      Demo
                    </Badge>
                  )}
                </div>
              </div>
              {isEntitySwitching ? (
                <Loader2 className="h-4 w-4 text-muted-foreground ml-auto animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200" />
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" side="right">
          <div className="p-3 border-b">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organisations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUserEntities()}
                className="px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredEntities.map((entity) => (
              <Button
                key={entity.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start p-3 h-auto rounded-none",
                  currentEntity?.id === entity.id && "bg-accent"
                )}
                onClick={() => handleEntityChange(entity.id)}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-semibold",
                    getEntityColor(entity)
                  )}>
                    {getEntityInitials(entity.name)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>{entity.name}</span>
                      {entity.is_demo && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5 bg-blue-100 text-blue-700 border-blue-200">
                          Demo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
            {filteredEntities.length === 0 && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No organisations found
              </div>
            )}
          </div>
          <div className="border-t p-2 space-y-1">
            <Link href="/entities" onClick={() => setIsOpen(false)} className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start text-sm">
                <Settings className="h-4 w-4 mr-2" />
                Manage organisations
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              onClick={() => {
                setIsOpen(false)
                router.push('/entities?create=true')
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add new organisation
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 