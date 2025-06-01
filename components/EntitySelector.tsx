'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, ChevronDown, Settings } from 'lucide-react'
import Link from 'next/link'

interface Entity {
  id: string
  name: string
  slug: string
  description?: string
  is_demo: boolean
  role: string
}

interface EntitySelectorProps {
  currentEntityId?: string
  onEntityChange?: (entityId: string) => void
  showManageButton?: boolean
}

export default function EntitySelector({ 
  currentEntityId, 
  onEntityChange,
  showManageButton = true 
}: EntitySelectorProps) {
  const [entities, setEntities] = useState<Entity[]>([])
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUserEntities()
  }, [])

  useEffect(() => {
    if (currentEntityId && entities.length > 0) {
      const entity = entities.find(e => e.id === currentEntityId)
      setCurrentEntity(entity || null)
    }
  }, [currentEntityId, entities])

  const fetchUserEntities = async () => {
    try {
      const response = await fetch('/api/entities')
      if (response.ok) {
        const result = await response.json()
        setEntities(result.entities || [])
        
        // If no current entity selected, use the first one or Demo Company
        if (!currentEntityId && result.entities?.length > 0) {
          const demoEntity = result.entities.find((e: Entity) => e.is_demo)
          const defaultEntity = demoEntity || result.entities[0]
          setCurrentEntity(defaultEntity)
          onEntityChange?.(defaultEntity.id)
        }
      }
    } catch (error) {
      console.error('Error fetching entities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEntityChange = (entityId: string) => {
    const entity = entities.find(e => e.id === entityId)
    if (entity) {
      setCurrentEntity(entity)
      onEntityChange?.(entityId)
      
      // Store the selected entity in localStorage for persistence
      localStorage.setItem('selectedEntityId', entityId)
      
      // Refresh the page to load data for the new entity
      window.location.reload()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-muted/50 animate-pulse">
        <Building2 className="h-4 w-4" />
        <div className="h-4 w-32 bg-muted rounded"></div>
      </div>
    )
  }

  if (!currentEntity && entities.length === 0) {
    return (
      <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No entities available</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-muted/50">
        <Building2 className="h-4 w-4 text-foreground" />
        <div className="flex flex-col">
          <Select value={currentEntity?.id || ''} onValueChange={handleEntityChange}>
            <SelectTrigger className="w-[200px] h-6 border-none shadow-none p-0 focus:ring-0">
              <SelectValue>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground">
                    {currentEntity?.name || 'Select Entity'}
                  </span>
                  {currentEntity && (
                    <span className="text-xs text-muted-foreground">
                      {currentEntity.is_demo ? 'Demo Company' : currentEntity.role}
                    </span>
                  )}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{entity.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entity.is_demo ? 'Demo Company' : entity.role}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {showManageButton && (
        <Link href="/entities">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Manage entities</span>
          </Button>
        </Link>
      )}
    </div>
  )
} 