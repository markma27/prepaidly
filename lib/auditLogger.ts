import { createServerSupabaseClient } from '@/lib/supabaseClient'

export interface AuditLogEntry {
  scheduleId: string
  entityId: string
  action: string
  actionType: 'created' | 'updated' | 'generated' | 'downloaded'
  details: string
  userId?: string
  userName?: string
  userEmail?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
}

export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get user info if not provided
    let userId = entry.userId
    let userName = entry.userName
    let userEmail = entry.userEmail

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
      userEmail = user?.email
      // Extract name from email if no name provided
      if (!userName && userEmail) {
        userName = userEmail.split('@')[0]
      }
    }

    // Get user display name using the new function
    let userDisplayName = userName
    if (userId) {
      const { data: displayNameResult } = await supabase
        .rpc('get_user_display_name', { user_id: userId })
      userDisplayName = displayNameResult || userName || 'Unknown User'
    }

    const auditEntry = {
      schedule_id: entry.scheduleId,
      entity_id: entry.entityId,
      action: entry.action,
      action_type: entry.actionType,
      details: entry.details,
      user_id: userId || null,
      user_name: userName || null,
      user_email: userEmail || null,
      user_display_name: userDisplayName || null,
      old_values: entry.oldValues || null,
      new_values: entry.newValues || null,
    }

    const { error } = await supabase
      .from('schedule_audit')
      .insert(auditEntry)

    if (error) {
      console.error('Failed to log audit entry:', error)
      // Don't throw error to avoid breaking the main operation
    }
  } catch (error) {
    console.error('Error in audit logging:', error)
    // Don't throw error to avoid breaking the main operation
  }
} 