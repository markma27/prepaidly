'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as DialogPrimitives from '@/components/ui/dialog'

const {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} = DialogPrimitives
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, Calendar, Crown, Users, Shield } from 'lucide-react'

interface Entity {
  id: string
  name: string
  slug: string
  description?: string
  is_demo: boolean
  created_at: string
  role: string
  joined_at: string
}

interface EntityManagementProps {
  entities: Entity[]
  userEmail: string
  shouldOpenCreateDialog?: boolean
}

export default function EntityManagement({ entities, userEmail, shouldOpenCreateDialog }: EntityManagementProps) {
  const router = useRouter()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Open create dialog if shouldOpenCreateDialog is true
  useEffect(() => {
    if (shouldOpenCreateDialog) {
      setIsCreateDialogOpen(true)
    }
  }, [shouldOpenCreateDialog])

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setCreateError('')

    try {
      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create entity')
      }

      // Reset form
      setFormData({ name: '', description: '' })
      setIsCreateDialogOpen(false)
      
      // Refresh the page to show the new entity
      router.refresh()

    } catch (error: any) {
      console.error('Error creating entity:', error)
      setCreateError(error.message || 'Failed to create entity')
    } finally {
      setIsCreating(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      case 'user':
        return <Users className="h-4 w-4 text-green-600" />
      default:
        return <Users className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
      case 'admin':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100'
      case 'user':
        return 'bg-green-100 text-green-800 hover:bg-green-100'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entity Management</h1>
            <p className="text-muted-foreground">Manage your organisations and team access</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateEntity}>
                <DialogHeader>
                  <DialogTitle>Create New Entity</DialogTitle>
                  <DialogDescription>
                    Create a new organisation or company entity. You'll be the super admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Entity Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Company LLC"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of your organisation..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  {createError && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      {createError}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating || !formData.name.trim()}>
                    {isCreating ? 'Creating...' : 'Create Entity'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Entities Table */}
        {entities.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px] py-3 text-left pl-9">Entity</TableHead>
                  <TableHead className="w-[100px] py-3 text-center">Status</TableHead>
                  <TableHead className="w-[150px] py-3 text-center">Your Role</TableHead>
                  <TableHead className="w-[120px] py-3 text-center">Joined</TableHead>
                  <TableHead className="w-[120px] py-3 text-center">Created</TableHead>
                  <TableHead className="w-[180px] py-3 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={entity.id} className="h-16">
                    <TableCell className="py-4 pl-8">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
                          <Building2 className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground truncate">{entity.name}</div>
                          {entity.description && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-[250px] truncate" title={entity.description}>
                              {entity.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex justify-center items-center">
                        {entity.is_demo ? (
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                            Demo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Live
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex justify-center items-center space-x-2">
                        {getRoleIcon(entity.role)}
                        <Badge className={getRoleBadgeColor(entity.role)}>
                          {entity.role.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-center">
                        {new Date(entity.joined_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-center">
                        {new Date(entity.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex justify-center items-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => router.push(`/dashboard?entity=${entity.id}`)}
                        >
                          Switch to this entity
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No entities found</h3>
                <p className="text-muted-foreground">
                  Create your first organisation to get started
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Entity
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
} 