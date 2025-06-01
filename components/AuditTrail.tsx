'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, User, Calendar, FileText, Edit, Plus } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface AuditEntry {
  id: string
  schedule_id: string
  action: string
  action_type: 'created' | 'updated' | 'generated' | 'downloaded'
  details: string
  user_name?: string
  user_email?: string
  created_at: string
}

interface AuditTrailProps {
  scheduleId: string
  isVisible?: boolean
}

const actionIcons = {
  created: Plus,
  updated: Edit,
  generated: FileText,
  downloaded: Calendar,
}

const actionColors = {
  created: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  updated: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  generated: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  downloaded: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
}

export default function AuditTrail({ scheduleId, isVisible = false }: AuditTrailProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isExpanded && scheduleId && isVisible) {
      fetchAuditTrail()
    }
  }, [isExpanded, scheduleId, isVisible])

  const fetchAuditTrail = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/audit`)
      if (!response.ok) {
        throw new Error('Failed to fetch audit trail')
      }
      
      const result = await response.json()
      setAuditEntries(result.auditEntries || [])
    } catch (error) {
      console.error('Error fetching audit trail:', error)
      setError('Failed to load audit trail')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM yyyy h:mm a')
  }

  const getUserDisplay = (entry: AuditEntry) => {
    if (entry.user_name) {
      return entry.user_name
    }
    if (entry.user_email) {
      return entry.user_email.split('@')[0]
    }
    return 'System Generated'
  }

  const getActionBadge = (actionType: AuditEntry['action_type']) => {
    const IconComponent = actionIcons[actionType]
    const colorClass = actionColors[actionType]
    
    return (
      <Badge className={`${colorClass} hover:${colorClass}`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
      </Badge>
    )
  }

  if (!isVisible) {
    return null
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors border-b border-border/50"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <h3 className="text-sm font-medium text-foreground">History and notes</h3>
          </div>
          <div className="text-xs text-muted-foreground">
            {auditEntries.length > 0 && `${auditEntries.length} entries`}
          </div>
        </button>

        {isExpanded && (
          <div className="p-4 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No history available for this schedule</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">User</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Action</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.map((entry) => (
                      <TableRow key={entry.id} className="border-border/30 hover:bg-muted/30">
                        <TableCell className="py-2 px-3">
                          <div className="text-xs text-foreground/80">
                            {formatDate(entry.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-foreground/80">
                              {getUserDisplay(entry)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          {getActionBadge(entry.action_type)}
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="text-xs text-foreground/70 max-w-md">
                            {entry.details}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 