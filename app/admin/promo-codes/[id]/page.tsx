/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export default async function PromoCodeStatsPage({ params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8 text-zinc-400">Unauthorized</div>
  const service = getSupabaseServiceClient() as any
  const { data: owner } = await service.from('users').select('is_creator').eq('owner_id', user.id).maybeSingle()
  if (!owner?.is_creator) return <div className="p-8 text-zinc-400">Forbidden</div>
  const [{ data: promo }, { data: redemptions }] = await Promise.all([
    service.from('promo_codes').select('*').eq('id', params.id).maybeSingle(),
    service.from('promo_code_redemptions').select('*, payments(status)').eq('promo_code_id', params.id).order('created_at', { ascending: false }).limit(100),
  ])
  if (!promo) return <div className="p-8 text-zinc-400">Promo code not found</div>
  const rows = redemptions ?? []
  const successful = rows.filter((r: any) => r.status === 'confirmed')
  const money = (n: number) => `$${(n / 100).toFixed(2)}`
  return <div className="mx-auto max-w-5xl p-6 text-white"><Link href="/admin/promo-codes" className="text-sm text-zinc-400 hover:text-white">← Promo codes</Link><h1 className="mt-4 text-2xl font-bold">{promo.code} statistics</h1><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Successful uses', successful.length], ['Reservations', rows.length], ['Discount granted', money(successful.reduce((s: number, r: any) => s + (r.discount_amount_cents || 0), 0))], ['Net revenue', money(successful.reduce((s: number, r: any) => s + (r.final_amount_cents || 0), 0))]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div><div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800"><table className="w-full text-left text-sm"><thead className="bg-zinc-900 text-zinc-500"><tr><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Original</th><th className="p-3">Discount</th><th className="p-3">Paid</th><th className="p-3">Currency</th></tr></thead><tbody>{rows.map((r: any) => <tr key={r.id} className="border-t border-zinc-800"><td className="p-3">{new Date(r.created_at).toLocaleString()}</td><td className="p-3">{r.status}</td><td className="p-3">{money(r.original_amount_cents)}</td><td className="p-3">{money(r.discount_amount_cents)}</td><td className="p-3">{money(r.final_amount_cents)}</td><td className="p-3">{r.currency}</td></tr>)}</tbody></table></div></div>
}
/* eslint-disable @typescript-eslint/no-explicit-any */
