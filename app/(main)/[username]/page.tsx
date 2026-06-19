import { notFound, redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import CreatorProfileClient from './CreatorProfileClient'
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

export default async function CreatorPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { payment?: string }
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()

  // Resolve the creator by username
  const { data: creator } = await service
    .from('users')
    .select('id, username, display_name, bio, avatar_url, banner_url, is_verified, is_creator, is_banned')
    .eq('username', params.username)
    .maybeSingle()

  if (!creator || !creator.is_creator || creator.is_banned) notFound()

  const [
    { data: rawPosts },
    { data: subscription },
    { data: ppvPayments },
    { count: subCount },
    { count: postCount },
  ] = await Promise.all([
    service.from('posts').select('*, media(id, url, media_type, sort_order)').eq('creator_id', creator.id).eq('is_published', true).order('published_at', { ascending: false }).limit(20),
    service.from('subscriptions').select('plan_id').eq('subscriber_id', user.id).eq('creator_id', creator.id).eq('status', 'active').gt('current_period_end', new Date().toISOString()).maybeSingle(),
    service.from('payments').select('post_id').eq('payer_id', user.id).eq('status', 'completed').not('post_id', 'is', null),
    service.from('subscriptions').select('*', { count: 'exact', head: true }).eq('creator_id', creator.id).eq('status', 'active'),
    service.from('posts').select('*', { count: 'exact', head: true }).eq('creator_id', creator.id).eq('is_published', true),
  ])

  const isSubscribed = !!subscription
  const unlockedPpvIds = (ppvPayments ?? []).map(p => (p as unknown as { post_id: string }).post_id).filter(Boolean)

  type MediaRow = { id: string; url: string; media_type: string; sort_order: number }
  type PostRow = { id: string; creator_id: string; body: string | null; post_type: 'free' | 'premium' | 'ppv'; ppv_price_cents: number | null; like_count: number; comment_count: number; published_at: string | null; created_at: string; media: MediaRow[] }

  const creatorName = creator.display_name ?? creator.username
  const creatorInitials = creatorName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'CR'

  const posts: Post[] = ((rawPosts ?? []) as unknown as PostRow[]).map(p => {
    const media = (p.media ?? []).sort((a: MediaRow, b: MediaRow) => a.sort_order - b.sort_order)
    return {
      id: p.id,
      creatorId: p.creator_id,
      creator: {
        name: creatorName,
        username: creator.username,
        initials: creatorInitials,
        verified: creator.is_verified,
        avatarUrl: creator.avatar_url ?? null,
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
    <CreatorProfileClient
      creator={{
        id: creator.id,
        name: creatorName,
        username: creator.username,
        initials: creatorInitials,
        verified: creator.is_verified,
        bio: creator.bio ?? '',
        avatarUrl: creator.avatar_url ?? null,
        bannerUrl: creator.banner_url ?? null,
        subscriberCount: subCount ?? 0,
        postCount: postCount ?? 0,
      }}
      posts={posts}
      isSubscribed={isSubscribed}
      unlockedPpvIds={unlockedPpvIds}
      viewerId={user.id}
      paymentStatus={searchParams.payment}
    />
  )
}
