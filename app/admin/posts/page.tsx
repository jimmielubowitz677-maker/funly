import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import PostsTable from './PostsTable'

export const dynamic = 'force-dynamic'

export default async function PostsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const creatorId = user.id
  const service   = getSupabaseServiceClient()

  // Core list query — only columns that definitely exist in the schema.
  // Stats (like_count, tip_total_cents) are fetched separately so a missing
  // column never breaks the list.
  const { data: posts } = await service
    .from('posts')
    .select('id,title,post_type,ppv_price_cents,is_published,created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  const postIds = (posts ?? []).map(p => p.id)

  // Fetch media counts, per-post stats, and PPV revenue in parallel.
  // All three are best-effort: if a column doesn't exist or a query errors
  // the table still renders — stats just show as zero.
  const [
    { data: mediaCounts },
    { data: postStats },
    { data: ppvPayments },
  ] = await Promise.all([
    postIds.length
      ? service.from('media').select('post_id,media_type').in('post_id', postIds)
      : Promise.resolve({ data: [] as { post_id: string | null; media_type: string }[] }),
    postIds.length
      ? service.from('posts').select('id,like_count,tip_total_cents').in('id', postIds)
      : Promise.resolve({ data: [] as { id: string; like_count: number; tip_total_cents: number }[] }),
    postIds.length
      ? service
          .from('payments')
          .select('post_id,amount_cents')
          .in('post_id', postIds)
          .eq('status', 'completed')
      : Promise.resolve({ data: [] as { post_id: string | null; amount_cents: number }[] }),
  ])

  const mediaMap: Record<string, { count: number; hasVideo: boolean }> = {}
  for (const m of mediaCounts ?? []) {
    if (!m.post_id) continue
    if (!mediaMap[m.post_id]) mediaMap[m.post_id] = { count: 0, hasVideo: false }
    mediaMap[m.post_id].count++
    if (m.media_type === 'video') mediaMap[m.post_id].hasVideo = true
  }

  const statsMap: Record<string, { like_count: number; tip_total_cents: number }> = {}
  for (const s of postStats ?? []) {
    statsMap[s.id] = { like_count: s.like_count ?? 0, tip_total_cents: s.tip_total_cents ?? 0 }
  }

  const ppvRevenueMap: Record<string, number> = {}
  for (const pay of ppvPayments ?? []) {
    if (!pay.post_id) continue
    ppvRevenueMap[pay.post_id] = (ppvRevenueMap[pay.post_id] ?? 0) + pay.amount_cents
  }

  const rows = (posts ?? []).map(p => ({
    ...p,
    media_count:    mediaMap[p.id]?.count ?? 0,
    has_video:      mediaMap[p.id]?.hasVideo ?? false,
    like_count:     statsMap[p.id]?.like_count ?? 0,
    earnings_cents: (statsMap[p.id]?.tip_total_cents ?? 0) + (ppvRevenueMap[p.id] ?? 0),
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Posts</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{rows.length} post{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Post</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <PostsTable posts={rows} />
      </div>
    </div>
  )
}
