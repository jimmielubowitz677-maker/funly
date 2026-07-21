import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

async function buildPost(postId: string, deliveredAt: string) {
  const service = getSupabaseServiceClient()
  const { data: post } = await service.from('posts').select('id,creator_id,body,post_type,ppv_price_cents,like_count,comment_count,comments_disabled,display_like_count,users!posts_creator_id_fkey(username,display_name,avatar_url,is_verified,is_online),media(id,url,media_type,sort_order)').eq('id', postId).maybeSingle()
  if (!post) return null
  const creator = post.users as unknown as { username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean; is_online: boolean }
  const media = ((post.media ?? []) as unknown as Array<{ url: string; media_type: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order)
  const name = creator.display_name ?? creator.username
  return { id: post.id, creatorId: post.creator_id, creator: { name, username: creator.username, initials: name.slice(0, 2).toUpperCase(), verified: creator.is_verified, avatarUrl: creator.avatar_url }, content: post.body ?? '', hasMedia: media.length > 0, mediaItems: media.map(m => ({ url: m.url, type: m.media_type as 'image' | 'video' })), type: post.post_type, ppvPrice: post.ppv_price_cents ? post.ppv_price_cents / 100 : undefined, likes: post.like_count, comments: post.comment_count, publishedAt: deliveredAt, isOnline: creator.is_online, commentsDisabled: post.comments_disabled, displayLikeCount: post.display_like_count, _section: 'personal' as const }
}

export async function POST() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabase.rpc('claim_first_login_delivery')
  if (error) return NextResponse.json({ error: 'Could not load your feed update' }, { status: 500 })
  const claim = data?.[0]
  if (!claim || !claim.created) return NextResponse.json({ created: false })
  const post = await buildPost(claim.post_id, claim.delivered_at)
  if (!post) return NextResponse.json({ created: false })
  return NextResponse.json({ created: true, deliveryId: claim.delivery_id, animationDelayMs: claim.animation_delay_ms, post })
}

export async function PATCH() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await supabase.from('first_login_deliveries').update({ animation_shown_at: new Date().toISOString() }).eq('user_id', user.id).is('animation_shown_at', null)
  if (error) return NextResponse.json({ error: 'Could not save display state' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
