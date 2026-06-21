import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const service = getSupabaseServiceClient()
  const { data, error } = await service
    .from('comments')
    .select('id, body, created_at, user_id, users(username, display_name, avatar_url)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (!text || text.length > 500) {
    return NextResponse.json({ error: 'Comment must be 1–500 characters' }, { status: 400 })
  }

  const service = getSupabaseServiceClient()

  // Check post exists and comments not disabled
  const { data: post } = await service
    .from('posts')
    .select('comments_disabled')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.comments_disabled) return NextResponse.json({ error: 'Comments are disabled' }, { status: 403 })

  const { data: comment, error } = await service
    .from('comments')
    .insert({ post_id: params.id, user_id: user.id, body: text })
    .select('id, body, created_at, user_id, users(username, display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Self-heal comment_count regardless of trigger state
  const { count: actualCount } = await service
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', params.id)
  await service.from('posts').update({ comment_count: actualCount ?? 0 }).eq('id', params.id)

  return NextResponse.json({ comment }, { status: 201 })
}
