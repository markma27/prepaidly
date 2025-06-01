import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { redirect } from 'next/navigation'
import { ProfileManagement } from '../../../components/ProfileManagement'

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  phone?: string
  timezone?: string
  email_notifications: boolean
  marketing_emails: boolean
  created_at: string
}

async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile data
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return {
    id: user.id,
    email: user.email || '',
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    avatar_url: profile?.avatar_url || '',
    phone: profile?.phone || '',
    timezone: profile?.timezone || 'UTC',
    email_notifications: profile?.email_notifications ?? true,
    marketing_emails: profile?.marketing_emails ?? false,
    created_at: profile?.created_at || user.created_at
  }
}

export default async function ProfilePage() {
  const profile = await getUserProfile()

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Profile Not Found</h1>
            <p className="text-muted-foreground">Unable to load your profile information.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <ProfileManagement profile={profile} />
      </div>
    </div>
  )
} 