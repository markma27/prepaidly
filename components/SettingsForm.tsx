'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Save, Check, AlertCircle, Settings, DollarSign, Clock, FileText, Zap, Plus, Trash2, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type AccountItem = {
  id: string
  name: string
  account: string
}

type UserSettings = {
  id?: string
  user_id: string
  currency: string
  timezone: string
  prepaid_accounts: AccountItem[]
  unearned_accounts: AccountItem[]
  xero_integration: {
    enabled: boolean
    tenant_id?: string
    client_id?: string
  }
} | null

interface SettingsFormProps {
  initialSettings: UserSettings
  currentEntityId?: string
}

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
]

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function SettingsForm({ initialSettings, currentEntityId }: SettingsFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState<{
    prepaid: { [key: string]: { name?: string; account?: string } }
    unearned: { [key: string]: { name?: string; account?: string } }
  }>({ prepaid: {}, unearned: {} })

  // Entity information state
  const [entityInfo, setEntityInfo] = useState({
    name: '',
    description: ''
  })
  const [isLoadingEntity, setIsLoadingEntity] = useState(true)

  const [settings, setSettings] = useState({
    currency: initialSettings?.currency || 'USD',
    timezone: initialSettings?.timezone || 'UTC',
    prepaid_accounts: initialSettings?.prepaid_accounts || [
      { id: '1', name: 'Insurance Prepayments', account: '1240 - Prepaid Insurance' },
      { id: '2', name: 'Subscription Prepayments', account: '1250 - Prepaid Subscriptions' },
      { id: '3', name: 'Service Prepayments', account: '1260 - Prepaid Services' },
    ],
    unearned_accounts: initialSettings?.unearned_accounts || [
      { id: '1', name: 'Subscription Income', account: '2340 - Unearned Subscription Revenue' },
    ],
    xero_integration: {
      enabled: initialSettings?.xero_integration?.enabled || false,
      tenant_id: initialSettings?.xero_integration?.tenant_id || '',
      client_id: initialSettings?.xero_integration?.client_id || '',
    }
  })

  // Fetch entity information
  useEffect(() => {
    if (currentEntityId) {
      fetchEntityInfo()
    }
  }, [currentEntityId])

  const fetchEntityInfo = async () => {
    try {
      const response = await fetch('/api/entities')
      if (response.ok) {
        const result = await response.json()
        const entity = result.entities?.find((e: any) => e.id === currentEntityId)
        if (entity) {
          setEntityInfo({
            name: entity.name || '',
            description: entity.description || ''
          })
        }
      }
    } catch (error) {
      console.error('Error fetching entity info:', error)
    } finally {
      setIsLoadingEntity(false)
    }
  }

  // Helper functions for managing accounts
  const addPrepaidAccount = () => {
    const newAccount: AccountItem = {
      id: Date.now().toString(),
      name: '',
      account: ''
    }
    setSettings(prev => ({
      ...prev,
      prepaid_accounts: [...prev.prepaid_accounts, newAccount]
    }))
  }

  const removePrepaidAccount = (index: number) => {
    setSettings(prev => ({
      ...prev,
      prepaid_accounts: prev.prepaid_accounts.filter((_, i) => i !== index)
    }))
    
    // Clear validation errors for removed account and reindex remaining errors
    setValidationErrors(prev => {
      const newPrepaidErrors: typeof prev.prepaid = {}
      Object.keys(prev.prepaid).forEach(key => {
        const keyIndex = parseInt(key)
        if (keyIndex < index) {
          newPrepaidErrors[keyIndex] = prev.prepaid[keyIndex]
        } else if (keyIndex > index) {
          newPrepaidErrors[keyIndex - 1] = prev.prepaid[keyIndex]
        }
      })
      return {
        ...prev,
        prepaid: newPrepaidErrors
      }
    })
  }

  const updatePrepaidAccount = (index: number, field: 'name' | 'account', value: string) => {
    setSettings(prev => ({
      ...prev,
      prepaid_accounts: prev.prepaid_accounts.map((account, i) => 
        i === index ? { ...account, [field]: value } : account
      )
    }))
    
    // Clear validation error when user starts typing
    if (value.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        prepaid: {
          ...prev.prepaid,
          [index]: {
            ...prev.prepaid[index],
            [field]: undefined
          }
        }
      }))
    }
  }

  const addUnearnedAccount = () => {
    const newAccount: AccountItem = {
      id: Date.now().toString(),
      name: '',
      account: ''
    }
    setSettings(prev => ({
      ...prev,
      unearned_accounts: [...prev.unearned_accounts, newAccount]
    }))
  }

  const removeUnearnedAccount = (index: number) => {
    setSettings(prev => ({
      ...prev,
      unearned_accounts: prev.unearned_accounts.filter((_, i) => i !== index)
    }))
    
    // Clear validation errors for removed account and reindex remaining errors
    setValidationErrors(prev => {
      const newUnearnedErrors: typeof prev.unearned = {}
      Object.keys(prev.unearned).forEach(key => {
        const keyIndex = parseInt(key)
        if (keyIndex < index) {
          newUnearnedErrors[keyIndex] = prev.unearned[keyIndex]
        } else if (keyIndex > index) {
          newUnearnedErrors[keyIndex - 1] = prev.unearned[keyIndex]
        }
      })
      return {
        ...prev,
        unearned: newUnearnedErrors
      }
    })
  }

  const updateUnearnedAccount = (index: number, field: 'name' | 'account', value: string) => {
    setSettings(prev => ({
      ...prev,
      unearned_accounts: prev.unearned_accounts.map((account, i) => 
        i === index ? { ...account, [field]: value } : account
      )
    }))
    
    // Clear validation error when user starts typing
    if (value.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        unearned: {
          ...prev.unearned,
          [index]: {
            ...prev.unearned[index],
            [field]: undefined
          }
        }
      }))
    }
  }

  // Validation function
  const validateAccounts = () => {
    const errors: typeof validationErrors = { prepaid: {}, unearned: {} }
    let hasErrors = false

    // Validate prepaid accounts
    settings.prepaid_accounts.forEach((account, index) => {
      const accountErrors: { name?: string; account?: string } = {}
      
      if (!account.name.trim()) {
        accountErrors.name = 'Account name is required'
        hasErrors = true
      }
      
      if (!account.account.trim()) {
        accountErrors.account = 'Account code & name is required'
        hasErrors = true
      }
      
      if (Object.keys(accountErrors).length > 0) {
        errors.prepaid[index] = accountErrors
      }
    })

    // Validate unearned accounts
    settings.unearned_accounts.forEach((account, index) => {
      const accountErrors: { name?: string; account?: string } = {}
      
      if (!account.name.trim()) {
        accountErrors.name = 'Account name is required'
        hasErrors = true
      }
      
      if (!account.account.trim()) {
        accountErrors.account = 'Account code & name is required'
        hasErrors = true
      }
      
      if (Object.keys(accountErrors).length > 0) {
        errors.unearned[index] = accountErrors
      }
    })

    setValidationErrors(errors)
    return !hasErrors
  }

  const handleSave = async () => {
    // Validate before saving
    if (!validateAccounts()) {
      setSaveStatus('error')
      setSaveMessage('Please fill in all required account fields')
      return
    }

    setIsSaving(true)
    setSaveStatus('idle')

    try {
      // Save entity information first
      if (currentEntityId && (entityInfo.name.trim() || entityInfo.description.trim())) {
        const entityResponse = await fetch(`/api/entities/${currentEntityId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: entityInfo.name.trim(),
            description: entityInfo.description.trim()
          }),
        })

        if (!entityResponse.ok) {
          const entityResult = await entityResponse.json()
          throw new Error(entityResult.error || 'Failed to save entity information')
        }
      }

      // Save settings
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          entityId: currentEntityId
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save settings')
      }

      setSaveStatus('success')
      setSaveMessage('Settings and entity information saved successfully')
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)

    } catch (error: any) {
      console.error('Error saving:', error)
      setSaveStatus('error')
      setSaveMessage(error.message || 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and integrations</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={isSaving || saveStatus === 'success'}
          className="min-w-32"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : saveStatus === 'success' ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Entity Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entity Information
          </CardTitle>
          <CardDescription>
            Manage your organization's basic information and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingEntity ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
                <div className="h-10 bg-muted rounded animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                <div className="h-20 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="entity-name">Organization Name</Label>
                <Input
                  id="entity-name"
                  value={entityInfo.name}
                  onChange={(e) => setEntityInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your organization name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity-description">Description</Label>
                <Textarea
                  id="entity-description"
                  value={entityInfo.description}
                  onChange={(e) => setEntityInfo(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your organization (optional)"
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Currency & Localization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency & Localization
          </CardTitle>
          <CardDescription>
            Configure your preferred currency and timezone settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select value={settings.currency} onValueChange={(value) => setSettings(prev => ({ ...prev, currency: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currency.symbol}</span>
                        <span>{currency.name} ({currency.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={settings.timezone} onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Default Account Mappings
          </CardTitle>
          <CardDescription>
            Configure default accounts for different types of prepaid and unearned transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prepaid Expense Accounts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Prepaid Expense Accounts</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPrepaidAccount}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </div>
            <div className="space-y-3">
              {settings.prepaid_accounts.map((account, index) => (
                <div key={account.id} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`prepaid-name-${account.id}`}>Account Name *</Label>
                    <Input
                      id={`prepaid-name-${account.id}`}
                      value={account.name}
                      onChange={(e) => updatePrepaidAccount(index, 'name', e.target.value)}
                      placeholder="e.g., Insurance Prepayments"
                      className={validationErrors.prepaid[index]?.name ? 'border-destructive' : ''}
                    />
                    {validationErrors.prepaid[index]?.name && (
                      <p className="text-sm text-destructive">{validationErrors.prepaid[index].name}</p>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`prepaid-account-${account.id}`}>Account Code & Name *</Label>
                    <Input
                      id={`prepaid-account-${account.id}`}
                      value={account.account}
                      onChange={(e) => updatePrepaidAccount(index, 'account', e.target.value)}
                      placeholder="e.g., 1240 - Prepaid Insurance"
                      className={validationErrors.prepaid[index]?.account ? 'border-destructive' : ''}
                    />
                    {validationErrors.prepaid[index]?.account && (
                      <p className="text-sm text-destructive">{validationErrors.prepaid[index].account}</p>
                    )}
                  </div>
                  {settings.prepaid_accounts.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePrepaidAccount(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Unearned Revenue Accounts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Unearned Revenue Accounts</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUnearnedAccount}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </div>
            <div className="space-y-3">
              {settings.unearned_accounts.map((account, index) => (
                <div key={account.id} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`unearned-name-${account.id}`}>Account Name *</Label>
                    <Input
                      id={`unearned-name-${account.id}`}
                      value={account.name}
                      onChange={(e) => updateUnearnedAccount(index, 'name', e.target.value)}
                      placeholder="e.g., Subscription Income"
                      className={validationErrors.unearned[index]?.name ? 'border-destructive' : ''}
                    />
                    {validationErrors.unearned[index]?.name && (
                      <p className="text-sm text-destructive">{validationErrors.unearned[index].name}</p>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`unearned-account-${account.id}`}>Account Code & Name *</Label>
                    <Input
                      id={`unearned-account-${account.id}`}
                      value={account.account}
                      onChange={(e) => updateUnearnedAccount(index, 'account', e.target.value)}
                      placeholder="e.g., 2340 - Unearned Subscription Revenue"
                      className={validationErrors.unearned[index]?.account ? 'border-destructive' : ''}
                    />
                    {validationErrors.unearned[index]?.account && (
                      <p className="text-sm text-destructive">{validationErrors.unearned[index].account}</p>
                    )}
                  </div>
                  {settings.unearned_accounts.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeUnearnedAccount(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Xero Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Xero Integration
            <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
          </CardTitle>
          <CardDescription>
            Connect your Xero account to automatically sync schedules and journal entries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Xero Integration Coming Soon</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  We're working on integrating with Xero to automatically create journal entries 
                  and sync your chart of accounts. This feature will be available in a future update.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            <div className="space-y-2">
              <Label htmlFor="xero-tenant">Xero Tenant ID</Label>
              <Input
                id="xero-tenant"
                disabled
                placeholder="Will be auto-populated"
                value={settings.xero_integration.tenant_id}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xero-client">Xero Client ID</Label>
              <Input
                id="xero-client"
                disabled
                placeholder="Will be auto-populated"
                value={settings.xero_integration.client_id}
              />
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Status Messages */}
      {saveStatus === 'success' && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <Check className="h-4 w-4 mr-2" />
            {saveMessage}
          </div>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {saveMessage}
          </div>
        </div>
      )}
    </div>
  )
} 