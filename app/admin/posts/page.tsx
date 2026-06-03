import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import PostsTable from './PostsTable'

export const dynamic = 'force-dynamic'

export default async function PostsPage() {
  const creatorId = process.env.CREATOR_ID?.trim() ?? ''
  const service   = getSupabaseServiceClient()

  const { data: posts } = await service
    .from('posts')
    .select('id,title,post_type,ppv_price_cents,is_published,created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  // Count media per post
  const postIds = (posts ?? []).map(p => p.id)
  const { data: mediaCounts } = postIds.length
    ? await service.from('media').select('post_id,media_type').in('post_id', postIds)
    : { data: [] }

  const mediaMap: Record<string, { count: number; hasVideo: boolean }> = {}
  for (const m of mediaCounts ?? []) {
    if (!m.post_id) continue
    if (!mediaMap[m.post_id]) mediaMap[m.post_id] = { count: 0, hasVideo: false }
    mediaMap[m.post_id].count++
    if (m.media_type === 'video') mediaMap[m.post_id].hasVideo = true
  }

  const rows = (posts ?? []).map(p => ({
    ...p,
    media_count: mediaMap[p.id]?.count ?? 0,
    has_video:   mediaMap[p.id]?.hasVideo ?? false,
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
