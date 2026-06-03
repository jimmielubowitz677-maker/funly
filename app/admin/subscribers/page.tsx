import { getSupabaseServiceClient } from '@/lib/supabase/server'
import Badge from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

const PLAN_LABEL: Record<string, string> = {
  fan: 'Fan', superfan: 'Superfan', vip: 'VIP',
}

function planBadge(planId: string | null) {
  if (!planId) return null
  const v = planId as 'fan' | 'superfan' | 'vip'
  const known: Array<'fan' | 'superfan' | 'vip'> = ['fan', 'superfan', 'vip']
  return known.includes(v) ? <Badge variant={v} /> : <span className="text-xs text-zinc-400">{PLAN_LABEL[planId] ?? planId}</span>
}

export default async function SubscribersPage() {
  const creatorId = process.env.CREATOR_ID?.trim() ?? ''
  const service   = getSupabaseServiceClient()

  const { data: subs } = await service
    .from('subscriptions')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  const subscriberIds = Array.from(new Set((subs ?? []).map(s => s.subscriber_id)))
  let userMap: Record<string, { username: string; email: string }> = {}

  if (subscriberIds.length) {
    const { data: users } = await service.from('users').select('id,username,email').in('id', subscriberIds)
    userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Subscribers</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{subs?.length ?? 0} total</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {subs?.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 md:px-5 py-3 text-left font-medium">Subscriber</th>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Plan</th>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Status</th>
                <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Amount</th>
                <th className="px-4 md:px-5 py-3 text-right font-medium hidden lg:table-cell">Renews</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub, i) => {
                const u = userMap[sub.subscriber_id]
                return (
                  <tr key={sub.id} className={`hover:bg-zinc-800/30 transition-colors ${i < subs.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                    <td className="px-4 md:px-5 py-4">
                      <p className="text-sm font-medium text-zinc-100">{u?.username ?? '—'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{u?.email ?? sub.subscriber_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-4 hidden sm:table-cell">{planBadge(sub.plan_id)}</td>
                    <td className="px-3 py-4 hidden sm:table-cell">
                      <Badge variant={sub.status as 'active' | 'cancelled' | 'expired' | 'past_due'} />
                    </td>
                    <td className="px-3 py-4 hidden md:table-cell">
                      <span className="text-sm text-zinc-300">${(sub.price_paid_cents / 100).toFixed(2)}</span>
                    </td>
                    <td className="px-4 md:px-5 py-4 text-right hidden lg:table-cell">
                      <span className="text-xs text-zinc-500">{new Date(sub.current_period_end).toLocaleDateString()}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-zinc-600 text-sm">No subscribers yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
