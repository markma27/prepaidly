import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { redirect } from 'next/navigation'
import { UserManagement } from '../../../components/UserManagement'

interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  is_active: boolean
  created_at: string
}

interface Invitation {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  invited_by_name: string
  created_at: string
  expires_at: string
}

async function getCurrentEntity(searchParams: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get entity from URL or find user's first entity
  let entityId = searchParams.entity
  
  if (!entityId) {
    const { data: userEntities } = await supabase
      .from('entity_users')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
    
    if (!userEntities?.length) {
      redirect('/entities')
    }
    
    entityId = userEntities[0].entity_id
  }

  // Verify user has access to this entity and is admin/super_admin
  const { data: userAccess } = await supabase
    .from('entity_users')
    .select('role')
    .eq('entity_id', entityId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!userAccess || !['super_admin', 'admin'].includes(userAccess.role)) {
    redirect('/dashboard')
  }

  return { entityId, currentUserId: user.id, currentUserRole: userAccess.role }
}

async function getEntityUsers(entityId: string) {
  const supabase = await createServerSupabaseClient()
  
  // Get the current user for permission checks
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  
  // First get entity users
  const { data: entityUsers, error: entityError } = await supabase
    .from('entity_users')
    .select(`
      id,
      role,
      is_active,
      created_at,
      user_id
    `)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (entityError) {
    console.error('Error fetching entity users:', entityError)
    return []
  }

  if (!entityUsers || entityUsers.length === 0) {
    return []
  }

  // Get profile data for these users
  const userIds = entityUsers.map(u => u.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds)

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  }

  // Create a map of profiles for easy lookup
  const profilesMap = new Map(
    (profiles || []).map(p => [p.id, p])
  )

  // Try to get email addresses from auth.admin (might fail)
  let emailMap = new Map()
  try {
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (!authError && authUsers) {
      emailMap = new Map(
        authUsers.users.map(u => [u.id, u.email])
      )
    }
  } catch (error) {
    console.warn('Could not fetch auth users data, trying alternative approach:', error)
  }

  return entityUsers.map(user => {
    const profile = profilesMap.get(user.user_id)
    let email = emailMap.get(user.user_id)
    
    // If we couldn't get email from admin API and this is the current user, use their email
    if (!email && currentUser && user.user_id === currentUser.id) {
      email = currentUser.email
    }
    
    return {
      id: user.user_id,
      email: email || 'Email not available',
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at
    }
  })
}

async function getEntityInvitations(entityId: string) {
  const supabase = await createServerSupabaseClient()
  
  // Try to fetch with new columns first, fallback to old structure if migration not applied
  let invitations: any[] = []
  let error: any = null
  
  try {
    const { data, error: fetchError } = await supabase
      .from('entity_invitations')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        created_at,
        expires_at,
        invited_by
      `)
      .eq('entity_id', entityId)
      .eq('accepted', false)
      .order('created_at', { ascending: false })
    
    invitations = data || []
    error = fetchError
  } catch (migrationError) {
    // Fallback to old structure if new columns don't exist
    console.warn('New columns not found, falling back to old structure:', migrationError)
    const { data, error: fallbackError } = await supabase
      .from('entity_invitations')
      .select(`
        id,
        email,
        role,
        created_at,
        expires_at,
        invited_by
      `)
      .eq('entity_id', entityId)
      .eq('accepted', false)
      .order('created_at', { ascending: false })
    
    invitations = data || []
    error = fallbackError
  }

  if (error) {
    console.error('Error fetching invitations:', error)
    return []
  }

  if (!invitations || invitations.length === 0) {
    return []
  }

  // Get inviter profiles
  const inviterIds = [...new Set(invitations.map(inv => inv.invited_by))]
  const { data: inviterProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', inviterIds)

  if (profilesError) {
    console.error('Error fetching inviter profiles:', profilesError)
  }

  const profilesMap = new Map(
    (inviterProfiles || []).map(p => [p.id, p])
  )

  return invitations.map(inv => {
    const inviterProfile = profilesMap.get(inv.invited_by)
    return {
      id: inv.id,
      email: inv.email,
      first_name: inv.first_name || null,
      last_name: inv.last_name || null,
      role: inv.role,
      invited_by_name: inviterProfile?.first_name && inviterProfile?.last_name 
        ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
        : 'Unknown',
      created_at: inv.created_at,
      expires_at: inv.expires_at
    }
  })
}

export default async function UsersPage({
  searchParams
}: {
  searchParams: { entity?: string }
}) {
  const { entityId, currentUserId, currentUserRole } = await getCurrentEntity(searchParams)
  const users = await getEntityUsers(entityId)
  const invitations = await getEntityInvitations(entityId)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <UserManagement
          users={users}
          invitations={invitations}
          entityId={entityId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </div>
    </div>
  )
} 