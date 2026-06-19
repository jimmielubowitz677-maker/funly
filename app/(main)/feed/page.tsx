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

function gradientFor(id: string): string {
  return GRADIENTS[id.charCodeAt(0) % GRADIENTS.length]
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { payment?: string }
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const creatorId = process.env.CREATOR_ID?.trim() ?? ''
  const service = getSupabaseServiceClient()

  const [
    { data: creatorRow },
    { data: rawPosts },
    { data: subscription },
    { data: ppvPayments },
    { count: subCount },
    { count: postCount },
  ] = await Promise.all([
    service.from('users').select('username, display_name, is_verified, bio, avatar_url, banner_url').eq('id', creatorId).maybeSingle(),
    service
      .from('posts')
      .select('*, media(id, url, media_type, sort_order)')
      .eq('creator_id', creatorId)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(20),
    service
      .from('subscriptions')
      .select('plan_id')
      .eq('subscriber_id', user.id)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .maybeSingle(),
    service
      .from('payments')
      .select('post_id')
      .eq('payer_id', user.id)
      .eq('status', 'completed')
      .not('post_id', 'is', null),
    service
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('status', 'active'),
    service
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('is_published', true),
  ])

  const isSubscribed = !!subscription
  const unlockedPpvIds = (ppvPayments ?? [])
    .map(p => (p as unknown as { post_id: string }).post_id)
    .filter(Boolean)

  const creatorName = creatorRow?.display_name ?? creatorRow?.username ?? 'Creator'
  const creatorUsername = creatorRow?.username ?? 'creator'
  const creatorInitials = creatorName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CR'

  const creator = {
    name: creatorName,
    username: creatorUsername,
    initials: creatorInitials,
    verified: creatorRow?.is_verified ?? false,
    bio: creatorRow?.bio ?? '',
    subscriberCount: subCount ?? 0,
    postCount: postCount ?? 0,
    avatarUrl: creatorRow?.avatar_url ?? null,
    bannerUrl: creatorRow?.banner_url ?? null,
  }

  type MediaRow = { id: string; url: string; media_type: string; sort_order: number }
  type PostWithMedia = {
    id: string
    body: string | null
    post_type: 'free' | 'premium' | 'ppv'
    ppv_price_cents: number | null
    like_count: number
    comment_count: number
    published_at: string | null
    created_at: string
    media: MediaRow[]
  }

  const posts: Post[] = ((rawPosts ?? []) as unknown as PostWithMedia[]).map(p => {
    const media = (p.media ?? []).sort((a: MediaRow, b: MediaRow) => a.sort_order - b.sort_order)
    const firstImage = media.find(m => m.media_type === 'image')

    return {
      id: p.id,
      creator: {
        name: creator.name,
        username: creator.username,
        initials: creator.initials,
        verified: creator.verified,
        avatarUrl: creator.avatarUrl,
      },
      content: p.body ?? '',
      hasMedia: media.length > 0,
      mediaUrl: firstImage?.url,
      mediaGradient: gradientFor(p.id),
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
      creator={creator}
      isSubscribed={isSubscribed}
      unlockedPpvIds={unlockedPpvIds}
      paymentStatus={searchParams.payment}
    />
  )
}
