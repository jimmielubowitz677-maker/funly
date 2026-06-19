import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import Badge from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const creatorId = user.id
  const service   = getSupabaseServiceClient()

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('payee_id', creatorId)
    .order('created_at', { ascending: false })

  const payerIds = Array.from(new Set((payments ?? []).map(p => p.payer_id)))
  let userMap: Record<string, { username: string; email: string }> = {}

  if (payerIds.length) {
    const { data: users } = await service.from('users').select('id,username,email').in('id', payerIds)
    userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  }

  const totalRevenue = (payments ?? []).filter(p => p.status === 'completed').reduce((s, p) => s + p.amount_cents, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Payments</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{payments?.length ?? 0} transactions</p>
        </div>
        {totalRevenue > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-zinc-500">Total earned</p>
            <p className="text-lg font-black text-emerald-400">${(totalRevenue / 100).toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {payments?.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 md:px-5 py-3 text-left font-medium">From</th>
                <th className="px-3 py-3 text-left font-medium">Amount</th>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Provider</th>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Status</th>
                <th className="px-4 md:px-5 py-3 text-right font-medium hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pmt, i) => {
                const u = userMap[pmt.payer_id]
                return (
                  <tr key={pmt.id} className={`hover:bg-zinc-800/30 transition-colors ${i < payments.length - 1 ? 'border-b border-zinc-800/60' : ''}`}>
                    <td className="px-4 md:px-5 py-4">
                      <p className="text-sm font-medium text-zinc-100">{u?.username ?? '—'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{u?.email ?? pmt.payer_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-sm font-semibold text-white">${(pmt.amount_cents / 100).toFixed(2)}</span>
                      <span className="text-xs text-zinc-500 ml-1">{pmt.currency}</span>
                    </td>
                    <td className="px-3 py-4 hidden sm:table-cell">
                      <Badge variant={pmt.provider as 'crypto' | 'stripe' | 'paypal'} />
                    </td>
                    <td className="px-3 py-4 hidden sm:table-cell">
                      <Badge variant={pmt.status as 'pending' | 'completed' | 'failed' | 'refunded'} />
                    </td>
                    <td className="px-4 md:px-5 py-4 text-right hidden md:table-cell">
                      <span className="text-xs text-zinc-500">{new Date(pmt.created_at).toLocaleDateString()}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-zinc-600 text-sm">No payments yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
