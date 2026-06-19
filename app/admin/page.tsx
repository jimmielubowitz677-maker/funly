import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, DollarSign, FileText, MessageSquare, Plus } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import Badge from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const creatorId = user.id
  const service   = getSupabaseServiceClient()

  const [
    { count: postCount },
    { count: subCount },
    { data: revenueRows },
    { count: msgCount },
    { data: recentPosts },
  ] = await Promise.all([
    service.from('posts').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId),
    service.from('subscriptions').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId).eq('status', 'active'),
    service.from('payments').select('amount_cents').eq('payee_id', creatorId).eq('status', 'completed'),
    service.from('messages').select('*', { count: 'exact', head: true }).or(`sender_id.eq.${creatorId},recipient_id.eq.${creatorId}`).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    service.from('posts').select('id,title,post_type,is_published,created_at').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(5),
  ])

  const revenue = (revenueRows ?? []).reduce((s, r) => s + r.amount_cents, 0)

  const STATS = [
    { label: 'Total Posts',      value: String(postCount ?? 0),          icon: FileText,      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'       },
    { label: 'Active Subs',      value: String(subCount ?? 0),           icon: Users,         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Total Revenue',    value: `$${(revenue / 100).toFixed(2)}`, icon: DollarSign,    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'     },
    { label: 'Messages (24 h)',  value: String(msgCount ?? 0),           icon: MessageSquare, color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20'       },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Platform performance overview</p>
        </div>
        <Link href="/admin/posts/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 hover:border-zinc-700 transition-colors">
            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center border ${bg} mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl md:text-2xl font-black text-white">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-zinc-800">
          <h2 className="font-bold text-sm">Recent Posts</h2>
          <Link href="/admin/posts" className="text-xs text-pink-400 hover:text-pink-300 font-medium transition-colors">View all →</Link>
        </div>

        {recentPosts?.length ? (
          <table className="w-full">
            <tbody>
              {recentPosts.map((post, i) => (
                <tr key={post.id} className={`hover:bg-zinc-800/30 transition-colors ${i < (recentPosts.length - 1) ? 'border-b border-zinc-800/60' : ''}`}>
                  <td className="px-4 md:px-5 py-3.5">
                    <span className="text-sm font-medium text-zinc-200 truncate block max-w-[180px] sm:max-w-xs">
                      {post.title ?? '(untitled)'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 hidden sm:table-cell">
                    <Badge variant={post.post_type as 'free' | 'premium' | 'ppv'} />
                  </td>
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    <Badge variant={post.is_published ? 'published' : 'draft'} />
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-right">
                    <span className="text-xs text-zinc-600">{new Date(post.created_at).toLocaleDateString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <p className="text-zinc-600 text-sm">No posts yet</p>
            <Link href="/admin/posts/new" className="inline-block mt-3 text-xs text-pink-400 hover:text-pink-300 font-medium transition-colors">
              Create your first post →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
