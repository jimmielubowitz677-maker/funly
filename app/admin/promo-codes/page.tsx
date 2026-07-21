import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import PromoCodesClient from './PromoCodesClient'
export const dynamic = 'force-dynamic'
export default async function PromoCodesPage() {
  const a = await getSupabaseServerClient(); const { data: { user } } = await a.auth.getUser(); if (!user) redirect('/login')
  const s = getSupabaseServiceClient(); const { data: owner } = await s.from('users').select('id').eq('owner_id', user.id).eq('is_creator', true).limit(1); if (!owner?.length) redirect('/feed')
  const { data } = await s.from('promo_codes').select('*').order('created_at', { ascending: false })
  return <PromoCodesClient initial={data ?? []} />
}
