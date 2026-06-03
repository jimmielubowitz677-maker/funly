import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from './supabase/server'

type AdminResult =
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }

export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const creatorId = process.env.CREATOR_ID?.trim()
  if (!user || !creatorId || user.id !== creatorId) {
    return {
      userId: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { userId: user.id, error: null }
}
