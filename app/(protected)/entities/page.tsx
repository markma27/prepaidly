import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'
import EntityManagement from '@/components/EntityManagement'

export default async function EntitiesPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch entities via API to reuse the same logic
  let transformedEntities: any[] = []
  
  try {
    // We'll fetch this server-side but using the same logic as the API
    // Fetch user's entity memberships
    const { data: entityUsers, error: entityUsersError } = await supabase
      .from('entity_users')
      .select('entity_id, role, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (entityUsersError) {
      console.error('Error fetching entity users:', entityUsersError)
    } else if (entityUsers && entityUsers.length > 0) {
      // Get the entity IDs
      const entityIds = entityUsers.map(eu => eu.entity_id)

      // Fetch the actual entities
      const { data: entities, error: entitiesError } = await supabase
        .from('entities')
        .select('id, name, slug, description, is_demo, created_at')
        .in('id', entityIds)
        .order('created_at', { ascending: false })

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError)
      } else if (entities) {
        // Transform the data to include role at the top level
        transformedEntities = entities.map(entity => {
          const userRole = entityUsers.find(eu => eu.entity_id === entity.id)
          return {
            ...entity,
            role: userRole?.role || 'user',
            joined_at: userRole?.created_at || entity.created_at
          }
        })
      }
    }
  } catch (error) {
    console.error('Error in entities page:', error)
  }

  // Debug info
  if (transformedEntities.length === 0) {
    console.warn('No entities found for user:', user.id)
  }

  return (
    <EntityManagement 
      entities={transformedEntities}
      userEmail={user.email || ''}
    />
  )
} 