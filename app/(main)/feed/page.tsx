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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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

  // Fetch recent posts from all creators
  const [{ data: rawPosts }, { data: subscriptions }, { data: ppvPayments }] = await Promise.all([
    creatorIds.length
      ? service.from('posts').select('*, media(id, url, media_type, sort_order)').in('creator_id', creatorIds).eq('is_published', true).order('published_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    service.from('subscriptions').select('creator_id').eq('subscriber_id', user.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()),
    service.from('payments').select('post_id').eq('payer_id', user.id).eq('status', 'completed').not('post_id', 'is', null),
  ])

  const subscribedCreatorIds = (subscriptions ?? []).map((s: { creator_id: string }) => s.creator_id)
  const unlockedPpvIds = (ppvPayments ?? []).map(p => (p as unknown as { post_id: string }).post_id).filter(Boolean)

  // Build posts array
  type MediaRow = { id: string; url: string; media_type: string; sort_order: number }
  type PostRow = { id: string; creator_id: string; body: string | null; post_type: 'free' | 'premium' | 'ppv'; ppv_price_cents: number | null; like_count: number; comment_count: number; published_at: string | null; created_at: string; media: MediaRow[] }

  const posts: Post[] = ((rawPosts ?? []) as unknown as PostRow[]).map(p => {
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
      timestamp: relativeTime(p.published_at ?? p.created_at),
    }
  })

  return (
    <FeedClient
      posts={posts}
      subscribedCreatorIds={subscribedCreatorIds}
      unlockedPpvIds={unlockedPpvIds}
    />
  )
}
