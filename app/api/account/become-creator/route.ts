import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getSupabaseServiceClient()

  // Ensure profile exists
  const { data: existing } = await service.from('users').select('id, is_creator').eq('id', user.id).maybeSingle()

  if (existing?.is_creator) {
    return NextResponse.json({ already: true })
  }

  const { error } = await service.from('users').update({ is_creator: true }).eq('id', user.id)
  if (error) {
    console.error('[become-creator]', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
