import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId  = params.id
  const service = getSupabaseServiceClient()

  // Check current like state
  const { data: existing } = await service
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    const { error: delErr } = await service
      .from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    if (delErr) {
      console.error('[like] DELETE failed:', delErr.code, delErr.message)
      return NextResponse.json({ error: 'Failed to unlike' }, { status: 500 })
    }
  } else {
    const { error: insErr } = await service
      .from('likes').insert({ user_id: user.id, post_id: postId })
    if (insErr) {
      console.error('[like] INSERT failed:', insErr.code, insErr.message)
      return NextResponse.json({ error: 'Failed to like' }, { status: 500 })
    }
  }

  // Count actual rows — makes trigger optional; also self-heals any drift
  const { count: actualCount } = await service
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  // Write the true count back to posts (idempotent whether trigger fired or not)
  await service
    .from('posts')
    .update({ like_count: actualCount ?? 0 })
    .eq('id', postId)

  return NextResponse.json({ liked: !existing, count: actualCount ?? 0 })
}
