import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user's entity memberships
    const { data: entityUsers, error: entityUsersError } = await supabase
      .from('entity_users')
      .select('entity_id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (entityUsersError) {
      console.error('Error fetching entity users:', entityUsersError)
      return NextResponse.json(
        { error: 'Failed to fetch user entities', details: entityUsersError.message },
        { status: 500 }
      )
    }

    if (!entityUsers || entityUsers.length === 0) {
      console.log('No entity memberships found for user:', user.id)
      return NextResponse.json({ entities: [] })
    }

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
      return NextResponse.json(
        { error: 'Failed to fetch entities', details: entitiesError.message },
        { status: 500 }
      )
    }

    // Transform the data to include role at the top level
    const transformedEntities = entities?.map(entity => {
      const userRole = entityUsers.find(eu => eu.entity_id === entity.id)
      return {
        ...entity,
        role: userRole?.role || 'user'
      }
    }) || []

    return NextResponse.json({ entities: transformedEntities })

  } catch (error) {
    console.error('Error in entities API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, description } = await request.json()

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Entity name is required and must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug already exists
    const { data: existingEntity } = await supabase
      .from('entities')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingEntity) {
      return NextResponse.json(
        { error: 'An entity with this name already exists' },
        { status: 400 }
      )
    }

    // Create the entity
    const { data: newEntity, error: createError } = await supabase
      .from('entities')
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        is_demo: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating entity:', createError)
      return NextResponse.json(
        { error: 'Failed to create entity' },
        { status: 500 }
      )
    }

    // Add the creator as super_admin
    const { error: userError } = await supabase
      .from('entity_users')
      .insert({
        entity_id: newEntity.id,
        user_id: user.id,
        role: 'super_admin',
        is_active: true
      })

    if (userError) {
      console.error('Error adding user to entity:', userError)
      // Clean up the entity if user creation failed
      await supabase.from('entities').delete().eq('id', newEntity.id)
      
      return NextResponse.json(
        { error: 'Failed to create entity membership' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      entity: {
        ...newEntity,
        role: 'super_admin'
      }
    })

  } catch (error) {
    console.error('Error in entities POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 