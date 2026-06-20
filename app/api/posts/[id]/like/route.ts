import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId  = params.id
  const service = getSupabaseServiceClient()

  // Check if already liked
  const { data: existing } = await service
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    await service.from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    const { data: post } = await service.from('posts').select('like_count').eq('id', postId).single()
    return NextResponse.json({ liked: false, count: post?.like_count ?? 0 })
  } else {
    await service.from('likes').insert({ user_id: user.id, post_id: postId })
    const { data: post } = await service.from('posts').select('like_count').eq('id', postId).single()
    return NextResponse.json({ liked: true, count: post?.like_count ?? 0 })
  }
}
