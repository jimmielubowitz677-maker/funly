import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'

export const dynamic = 'force-dynamic'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default async function VisitorsPage() {
  const { error } = await requireAdmin()
  if (error) redirect('/feed')

  const service = getSupabaseServiceClient()

  const { data: rows } = await service
    .from('page_views')
    .select('id, email, path, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const views = (rows ?? []) as Array<{ id: number; email: string | null; path: string; created_at: string }>

  // Summary: unique emails (logged-in visitors) in last 24h
  const since24h = new Date(Date.now() - 86400000).toISOString()
  const recentEmails = new Set(
    views.filter(v => v.created_at > since24h && v.email).map(v => v.email!)
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Visitor Log</h1>
          <p className="text-zinc-500 text-sm">Recent page views (logged-in users)</p>
        </div>
      </div>

      {/* 24h summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">{views.filter(v => v.created_at > since24h).length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Page views (24h)</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">{recentEmails.size}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Unique visitors (24h)</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-white">{views.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total logged (last 200)</p>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {views.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">No visits logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Path</th>
                  <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {views.map(v => (
                  <tr key={v.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3 text-zinc-300 font-medium truncate max-w-[200px]">
                      {v.email ?? <span className="text-zinc-600 italic">anonymous</span>}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-xs truncate max-w-[220px]">{v.path}</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs whitespace-nowrap">{timeAgo(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
