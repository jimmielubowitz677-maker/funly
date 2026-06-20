import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId  = params.id
  const service = getSupabaseServiceClient()

  console.log('[like] POST — userId:', user.id, 'postId:', postId)

  // Check if already liked
  const { data: existing, error: existErr } = await service
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle()

  console.log('[like] existing check — found:', !!existing, 'error:', existErr?.message ?? null)

  if (existing) {
    const { error: delErr } = await service
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)
    console.log('[like] DELETE — error:', delErr?.message ?? null)

    const { count: likesInTable } = await service
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    const { data: post } = await service
      .from('posts')
      .select('like_count, display_like_count')
      .eq('id', postId)
      .single()

    console.log('[like] after DELETE — likes rows in table:', likesInTable, 'posts.like_count:', post?.like_count, 'posts.display_like_count:', post?.display_like_count)

    return NextResponse.json({ liked: false, count: post?.like_count ?? 0 })
  } else {
    const { error: insErr } = await service
      .from('likes')
      .insert({ user_id: user.id, post_id: postId })
    console.log('[like] INSERT — error:', insErr?.code ?? null, insErr?.message ?? null)

    const { count: likesInTable } = await service
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    const { data: post } = await service
      .from('posts')
      .select('like_count, display_like_count')
      .eq('id', postId)
      .single()

    console.log('[like] after INSERT — likes rows in table:', likesInTable, 'posts.like_count:', post?.like_count, 'posts.display_like_count:', post?.display_like_count)

    return NextResponse.json({ liked: true, count: post?.like_count ?? 0 })
  }
}
