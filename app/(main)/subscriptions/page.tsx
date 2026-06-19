import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const service = getSupabaseServiceClient()
  const { data: creators } = await service
    .from('users')
    .select('id, username, display_name, bio, avatar_url, is_verified')
    .eq('is_creator', true)
    .eq('is_banned', false)
    .order('created_at', { ascending: true })

  // For each creator, get their subscriber count and post count
  const creatorIds = (creators ?? []).map((c: { id: string }) => c.id)
  const subCounts: Record<string, number> = {}
  const postCounts: Record<string, number> = {}

  if (creatorIds.length) {
    const [{ data: subs }, { data: posts }] = await Promise.all([
      service.from('subscriptions').select('creator_id').eq('status', 'active').in('creator_id', creatorIds),
      service.from('posts').select('creator_id').eq('is_published', true).in('creator_id', creatorIds),
    ])
    for (const s of subs ?? []) subCounts[(s as { creator_id: string }).creator_id] = (subCounts[(s as { creator_id: string }).creator_id] ?? 0) + 1
    for (const p of posts ?? []) postCounts[(p as { creator_id: string }).creator_id] = (postCounts[(p as { creator_id: string }).creator_id] ?? 0) + 1
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black mb-2">Discover Creators</h1>
        <p className="text-zinc-400">Subscribe to your favourite creators for exclusive content.</p>
      </div>
      {(creators ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">No creators yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(creators ?? []).map((c: { id: string; username: string; display_name: string | null; bio: string | null; avatar_url: string | null; is_verified: boolean }) => {
            const name = c.display_name ?? c.username
            const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'CR'
            return (
              <Link key={c.id} href={`/${c.username}`} className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/40">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 overflow-hidden flex items-center justify-center text-lg font-bold text-white shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt={name} className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-white truncate">{name}</p>
                      {c.is_verified && (
                        <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">@{c.username}</p>
                  </div>
                </div>
                {c.bio && <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{c.bio}</p>}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span><strong className="text-white">{subCounts[c.id] ?? 0}</strong> subscribers</span>
                  <span><strong className="text-white">{postCounts[c.id] ?? 0}</strong> posts</span>
                </div>
                <div className="mt-4 text-xs font-semibold text-pink-400 group-hover:text-pink-300 transition-colors">
                  View Profile →
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
