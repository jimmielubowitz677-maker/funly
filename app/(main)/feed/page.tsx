import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import FeedClient from './FeedClient'
import type { Post } from '@/components/PostCard'

export const dynamic = 'force-dynamic'

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
    .select('id, username, display_name, is_verified, avatar_url')
    .eq('is_creator', true)
    .eq('is_banned', false)

  const creatorIds = (creators ?? []).map((c: { id: string }) => c.id)

  const creatorMap = Object.fromEntries(
    (creators ?? []).map((c: { id: string; username: string; display_name: string | null; is_verified: boolean; avatar_url: string | null }) => [c.id, c])
  )

  const [{ data: subscriptions }, { data: ppvPayments }, { data: likedRows }] = await Promise.all([
    service.from('subscriptions').select('creator_id').eq('subscriber_id', user.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()),
    service.from('payments').select('post_id').eq('payer_id', user.id).eq('status', 'completed').not('post_id', 'is', null),
    service.from('likes').select('post_id').eq('user_id', user.id),
  ])

  const subscribedCreatorIds = (subscriptions ?? []).map((s: { creator_id: string }) => s.creator_id)
  const unlockedPpvIds = (ppvPayments ?? []).map(p => (p as unknown as { post_id: string }).post_id).filter(Boolean)
  const likedPostIds = new Set((likedRows ?? []).map((r: { post_id: string }) => r.post_id))

  // Personalized fetch: subscribed creators first (up to 20), then discovery (up to 15)
  const subscribedSet  = new Set(subscribedCreatorIds)
  const subscribedIds  = creatorIds.filter(id => subscribedSet.has(id))
  const discoveryIds   = creatorIds.filter(id => !subscribedSet.has(id))

  const [{ data: subscribedPosts }, { data: discoveryPosts }] = await Promise.all([
    subscribedIds.length
      ? service.from('posts').select('*, media(id, url, media_type, sort_order)').in('creator_id', subscribedIds).eq('is_published', true).order('published_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    discoveryIds.length
      ? service.from('posts').select('*, media(id, url, media_type, sort_order)').in('creator_id', discoveryIds).eq('is_published', true).order('published_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: [] }),
  ])

  // Tag each post so the client can render section headers
  const rawPosts = [
    ...(subscribedPosts ?? []).map((p: unknown) => ({ ...(p as object), _section: 'subscribed' as const })),
    ...(discoveryPosts  ?? []).map((p: unknown) => ({ ...(p as object), _section: 'discover'   as const })),
  ]

  // Build posts array
  type MediaRow = { id: string; url: string; media_type: string; sort_order: number }
  type PostRow = { _section: 'subscribed' | 'discover'; id: string; creator_id: string; body: string | null; post_type: 'free' | 'premium' | 'ppv'; ppv_price_cents: number | null; like_count: number; comment_count: number; published_at: string | null; created_at: string; media: MediaRow[] }

  const posts: (Post & { _section: 'subscribed' | 'discover' })[] = ((rawPosts ?? []) as unknown as PostRow[]).map(p => {
    const c = creatorMap[p.creator_id] as { id: string; username: string; display_name: string | null; is_verified: boolean; avatar_url: string | null } | undefined
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
      commentsDisabled: (p as unknown as { comments_disabled: boolean }).comments_disabled ?? false,
      displayLikeCount: (p as unknown as { display_like_count: number | null }).display_like_count ?? null,
      _section: p._section,
    }
  })

  return (
    <FeedClient
      posts={posts}
      subscribedCreatorIds={subscribedCreatorIds}
      unlockedPpvIds={unlockedPpvIds}
      userId={user.id}
      likedPostIds={Array.from(likedPostIds)}
      hasSubscriptions={subscribedIds.length > 0}
    />
  )
}
