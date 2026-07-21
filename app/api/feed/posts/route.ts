import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20
const GRADIENTS = ['from-orange-400/30 to-rose-500/30','from-pink-500/30 to-purple-600/30','from-red-500/30 to-pink-600/30','from-cyan-400/30 to-blue-500/30','from-amber-400/30 to-orange-500/30','from-emerald-400/30 to-teal-500/30']

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const cursorDate = request.nextUrl.searchParams.get('published_at')
  const cursorId = request.nextUrl.searchParams.get('id')
  if ((cursorDate && !cursorId) || (!cursorDate && cursorId)) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })

  const service = getSupabaseServiceClient()
  const [{ data: creators }, { data: subscriptions }, { data: ppvPayments }, { data: likedRows }] = await Promise.all([
    service.from('users').select('id,username,display_name,is_verified,avatar_url,is_online').eq('is_creator', true).eq('is_banned', false),
    service.from('subscriptions').select('creator_id').eq('subscriber_id', user.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()),
    service.from('payments').select('post_id').eq('payer_id', user.id).eq('status', 'completed').not('post_id', 'is', null),
    service.from('likes').select('post_id').eq('user_id', user.id),
  ])
  const creatorIds = (creators ?? []).map(c => c.id)
  if (!creatorIds.length) return NextResponse.json({ posts: [], hasMore: false, nextCursor: null })
  const subscribed = new Set((subscriptions ?? []).map(s => s.creator_id))
  const unlocked = (ppvPayments ?? []).map(p => p.post_id).filter(Boolean)
  const liked = (likedRows ?? []).map(p => p.post_id)
  let query = service.from('posts').select('*, media(id,url,media_type,sort_order)').in('creator_id', creatorIds).eq('is_published', true).not('published_at', 'is', null)
  if (cursorDate && cursorId) query = query.or(`published_at.lt.${cursorDate},and(published_at.eq.${cursorDate},id.lt.${cursorId})`)
  const { data, error } = await query.order('published_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE + 1)
  if (error) return NextResponse.json({ error: 'Could not load more posts' }, { status: 500 })
  const hasMore = (data ?? []).length > PAGE_SIZE
  const rows = (data ?? []).slice(0, PAGE_SIZE)
  const creatorMap = Object.fromEntries((creators ?? []).map(c => [c.id, c]))
  const posts = rows.map(p => {
    const c = creatorMap[p.creator_id]
    const name = c?.display_name ?? c?.username ?? 'Creator'
    const media = ((p.media ?? []) as unknown as Array<{ id: string; url: string; media_type: string; sort_order: number }>).sort((a, b) => a.sort_order - b.sort_order)
    return { id: p.id, creatorId: p.creator_id, creator: { name, username: c?.username ?? 'creator', initials: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CR', verified: c?.is_verified ?? false, avatarUrl: c?.avatar_url ?? null }, content: p.body ?? '', hasMedia: media.length > 0, mediaItems: media.map(m => ({ url: m.url, type: m.media_type as 'image' | 'video' })), mediaGradient: GRADIENTS[p.id.charCodeAt(0) % GRADIENTS.length], type: p.post_type, ppvPrice: p.ppv_price_cents ? p.ppv_price_cents / 100 : undefined, likes: p.like_count, comments: p.comment_count, publishedAt: p.published_at, isOnline: c?.is_online ?? false, commentsDisabled: p.comments_disabled ?? false, displayLikeCount: p.display_like_count ?? null, _section: subscribed.has(p.creator_id) ? 'subscribed' as const : 'discover' as const, isSubscribed: subscribed.has(p.creator_id), isUnlocked: unlocked.includes(p.id), isLiked: liked.includes(p.id) }
  })
  const last = rows[rows.length - 1]
  return NextResponse.json({ posts, hasMore, nextCursor: last ? { publishedAt: last.published_at, id: last.id } : null })
}
