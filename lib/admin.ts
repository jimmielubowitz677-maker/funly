import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from './supabase/server'

type AdminResult =
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }

export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { userId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const service = getSupabaseServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('is_creator')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_creator) {
    return { userId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { userId: user.id, error: null }
}
