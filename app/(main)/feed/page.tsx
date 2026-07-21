import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import FeedClient from './FeedClient'
import type { Post } from '@/components/PostCard'

export const dynamic = 'force-dynamic'
const FEED_PAGE_SIZE = 20

const GRADIENTS = [
  'from-orange-400/30 to-rose-500/30',
  'from-pink-500/30 to-purple-600/30',
  'from-red-500/30 to-pink-600/30',
  'from-cyan-400/30 to-blue-500/30',
  'from-amber-400/30 to-orange-500/30',
  'from-emerald-400/30 to-teal-500/30',
]

export default async function FeedPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()

  // Fetch all active creators
  const { data: creators } = await service
    .from('users')
    .select('id, username, display_name, is_verified, avatar_url, is_online')
    .eq('is_creator', true)
    .eq('is_banned', false)

  const creatorIds = (creators ?? []).map((c: { id: string }) => c.id)

  const creatorMap = Object.fromEntries(
    (creators ?? []).map(c => [c.id, c])
  )

  const [{ data: subscriptions }, { data: ppvPayments }, { data: likedRows }] = await Promise.all([
    service.from('subscriptions').select('creator_id').eq('subscriber_id', user.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()),
    service.from('payments').select('post_id').eq('payer_id', user.id).eq('status', 'completed').not('post_id', 'is', null),
    service.from('likes').select('post_id').eq('user_id', user.id),
  ])

  const subscribedCreatorIds = (subscriptions ?? []).map((s: { creator_id: string }) => s.creator_id)
  const unlockedPpvIds = (ppvPayments ?? []).map(p => (p as unknown as { post_id: string }).post_id).filter(Boolean)
  const likedPostIds = new Set((likedRows ?? []).map((r: { post_id: string }) => r.post_id))

  // Load one deterministic page. Subscription state is a presentation flag;
  // posts remain globally ordered by published_at/id for cursor pagination.
  const subscribedSet  = new Set(subscribedCreatorIds)
  const subscribedIds  = creatorIds.filter(id => subscribedSet.has(id))

  const { data: pagePosts } = creatorIds.length
    ? await service.from('posts').select('*, media(id, url, media_type, sort_order)').in('creator_id', creatorIds).eq('is_published', true).not('published_at', 'is', null).order('published_at', { ascending: false }).order('id', { ascending: false }).limit(FEED_PAGE_SIZE + 1)
    : { data: [] }
  const pageHasMore = (pagePosts ?? []).length > FEED_PAGE_SIZE
  const visiblePagePosts = (pagePosts ?? []).slice(0, FEED_PAGE_SIZE)

  // Tag each post so the client can render section headers
  const rawPosts = visiblePagePosts.map((p: unknown) => ({ ...(p as object), _section: subscribedSet.has((p as { creator_id: string }).creator_id) ? 'subscribed' as const : 'discover' as const }))

  // Build posts array
  type MediaRow = { id: string; url: string; media_type: string; sort_order: number }
  type PostRow = { _section: 'subscribed' | 'discover'; id: string; creator_id: string; body: string | null; post_type: 'free' | 'premium' | 'ppv'; ppv_price_cents: number | null; like_count: number; comment_count: number; published_at: string | null; created_at: string; media: MediaRow[] }

  const posts: (Post & { _section: 'subscribed' | 'discover' })[] = ((rawPosts ?? []) as unknown as PostRow[]).map(p => {
    const c = creatorMap[p.creator_id]
    const media = (p.media ?? []).sort((a: MediaRow, b: MediaRow) => a.sort_order - b.sort_order)
    const creatorName = c?.display_name ?? c?.username ?? 'Creator'
    const creatorUsername = c?.username ?? 'creator'
    return {
      id: p.id,
      creatorId: p.creator_id,
      creator: {
        name: creatorName,
        username: creatorUsername,
        initials: creatorName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'CR',
        verified: c?.is_verified ?? false,
        avatarUrl: c?.avatar_url ?? null,
      },
      content: p.body ?? '',
      hasMedia: media.length > 0,
      mediaItems: media.map((m: MediaRow) => ({ url: m.url, type: m.media_type as 'image' | 'video' })),
      mediaGradient: GRADIENTS[p.id.charCodeAt(0) % GRADIENTS.length],
      type: p.post_type,
      ppvPrice: p.ppv_price_cents ? p.ppv_price_cents / 100 : undefined,
      likes: p.like_count,
      comments: p.comment_count,
      publishedAt: p.published_at,
      isOnline: c?.is_online ?? false,
      commentsDisabled: (p as unknown as { comments_disabled: boolean }).comments_disabled ?? false,
      displayLikeCount: (p as unknown as { display_like_count: number | null }).display_like_count ?? null,
      _section: p._section,
    }
  })

  const { data: delivery } = await service.from('first_login_deliveries').select('id,post_id,delivered_at,animation_shown_at,campaign_id').eq('user_id', user.id).maybeSingle()
  let personalPost: (Post & { _section: 'personal' }) | null = null
  let personalDelay = 1000
  if (delivery?.post_id) {
    const [{ data: deliveredPost }, { data: campaign }] = await Promise.all([
      service.from('posts').select('*, media(id,url,media_type,sort_order)').eq('id', delivery.post_id).maybeSingle(),
      service.from('first_login_campaigns').select('animation_delay_ms').eq('id', delivery.campaign_id).maybeSingle(),
    ])
    if (deliveredPost) {
      const c = creatorMap[deliveredPost.creator_id]
      if (c) {
        const media = Array.from((deliveredPost.media ?? []) as unknown as MediaRow[]).sort((a, b) => a.sort_order - b.sort_order)
        const name = c.display_name ?? c.username
        personalPost = { id: deliveredPost.id, creatorId: deliveredPost.creator_id, creator: { name, username: c.username, initials: name.slice(0, 2).toUpperCase(), verified: c.is_verified, avatarUrl: c.avatar_url }, content: deliveredPost.body ?? '', hasMedia: media.length > 0, mediaItems: media.map(m => ({ url: m.url, type: m.media_type as 'image' | 'video' })), type: deliveredPost.post_type, ppvPrice: deliveredPost.ppv_price_cents ? deliveredPost.ppv_price_cents / 100 : undefined, likes: deliveredPost.like_count, comments: deliveredPost.comment_count, publishedAt: delivery.delivered_at, isOnline: c.is_online, isPersonalDelivery: true, commentsDisabled: deliveredPost.comments_disabled, displayLikeCount: deliveredPost.display_like_count, _section: 'personal' }
        personalDelay = campaign?.animation_delay_ms ?? 1000
      }
    }
  }

  return (
    <FeedClient
      posts={posts}
      subscribedCreatorIds={subscribedCreatorIds}
      unlockedPpvIds={unlockedPpvIds}
      userId={user.id}
      likedPostIds={Array.from(likedPostIds)}
      hasSubscriptions={subscribedIds.length > 0}
      initialPersonalPost={personalPost}
      initialPersonalAnimationShown={!!delivery?.animation_shown_at}
      initialPersonalDelayMs={personalDelay}
      initialHasMore={pageHasMore}
      initialCursor={posts.length ? { publishedAt: posts[posts.length - 1].publishedAt, id: posts[posts.length - 1].id } : null}
    />
  )
}
