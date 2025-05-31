import { createServerSupabaseClient } from '@/lib/supabaseClient'
import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  
  await supabase.auth.signOut()
  
  return NextResponse.redirect(new URL('/login', request.url))
} 