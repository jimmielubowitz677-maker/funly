/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

const PLANS: Record<string, number> = { fan: 999, superfan: 1999, vip: 4999 }

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { code?: string; planId?: string; postId?: string }
  const code = body.code?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 })
  const service = getSupabaseServiceClient() as any
  let originalCents: number
  let purchaseType: string
  let targetId: string | null = null
  if (body.planId) {
    originalCents = PLANS[body.planId]
    purchaseType = 'subscription'
    targetId = body.planId
  } else if (body.postId) {
    const { data: post } = await service.from('posts').select('ppv_price_cents,creator_id').eq('id', body.postId).maybeSingle()
    if (!post?.ppv_price_cents) return NextResponse.json({ error: 'Promo code is not valid for this purchase' }, { status: 400 })
    originalCents = post.ppv_price_cents
    purchaseType = 'ppv'
    targetId = body.postId
  } else return NextResponse.json({ error: 'Invalid purchase' }, { status: 400 })
  if (!originalCents) return NextResponse.json({ error: 'Invalid purchase' }, { status: 400 })
  const { data: promo } = await service.from('promo_codes').select('*').eq('code', code).maybeSingle()
  if (!promo) return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 })
  const now = Date.now()
  if (!promo.is_active) return NextResponse.json({ error: 'Promo code is inactive' }, { status: 400 })
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return NextResponse.json({ error: 'Promo code is not active yet' }, { status: 400 })
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) return NextResponse.json({ error: 'Promo code has expired' }, { status: 400 })
  if (promo.minimum_order_amount_cents != null && originalCents < promo.minimum_order_amount_cents) return NextResponse.json({ error: 'Minimum purchase amount not reached' }, { status: 400 })
  const applies = promo.applies_to
  if (!(applies === 'all' || (applies === 'subscription' && purchaseType === 'subscription') || (applies === 'ppv' && purchaseType === 'ppv') || (applies === 'plan' && targetId === promo.target_id) || (applies === 'post' && targetId === promo.target_id))) return NextResponse.json({ error: 'Promo code is not valid for this purchase' }, { status: 400 })
  const discountCents = Math.round(originalCents * promo.discount_percent / 100)
  return NextResponse.json({ code, discountPercent: promo.discount_percent, originalAmountCents: originalCents, discountAmountCents: discountCents, finalAmountCents: Math.max(0, originalCents - discountCents) })
}
/* eslint-disable @typescript-eslint/no-explicit-any */
