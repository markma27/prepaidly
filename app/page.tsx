import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseClient'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
