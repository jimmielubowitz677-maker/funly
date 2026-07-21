/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { createInvoice } from '@/lib/nowpayments'

const PLANS: Record<string, { price: number; label: string }> = {
  fan:      { price: 9.99,  label: 'Fan Plan — 1 month'      },
  superfan: { price: 19.99, label: 'Superfan Plan — 1 month' },
  vip:      { price: 49.99, label: 'VIP Plan — 1 month'      },
}

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

// Guarantees a row exists in public.users for the given Supabase auth user id.
// Safe to call for existing users — does nothing if the row is already there.
async function ensureProfile(
  service: ServiceClient,
  authUserId: string,
  extras: { is_creator?: boolean } = {}
): Promise<string | null> {
  // Check for an existing profile first to avoid unnecessary admin API call
  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle()

  if (existing) {
    // If we need to mark as creator and it isn't already, update now
    if (extras.is_creator) {
      await service.from('users').update({ is_creator: true }).eq('id', authUserId)
    }
    return authUserId
  }

  // Fetch the auth user record so we have email + can derive a username
  const { data: authData } = await service.auth.admin.getUserById(authUserId)
  const authUser = authData?.user
  if (!authUser?.email) {
    console.error('[ensureProfile] auth user not found or has no email:', authUserId)
    return null
  }

  const email = authUser.email
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user'
  const username = `${prefix}_${authUserId.slice(0, 6)}`

  const { error } = await service.from('users').insert({
    id: authUserId,
    username,
    email,
    is_creator: extras.is_creator ?? false,
  })

  if (error) {
    // Race condition: another request already created the profile
    if (error.code === '23505') return authUserId
    console.error('[ensureProfile] insert failed:', error)
    return null
  }

  return authUserId
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const planId = (body as { planId?: string; creatorId?: string; promoCode?: string } | null)?.planId
  const requestedCreatorId = (body as { planId?: string; creatorId?: string } | null)?.creatorId
  const promoCode = (body as { promoCode?: string } | null)?.promoCode?.trim() || null

  if (!planId || !PLANS[planId]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  if (!requestedCreatorId) {
    return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 })
  }

  // ── Authenticate the subscriber ──
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Please sign in to subscribe.' }, { status: 401 })
  }

  const service = getSupabaseServiceClient() as any

  // ── Ensure subscriber profile ──
  const subscriberId = await ensureProfile(service, user.id)
  if (!subscriberId) {
    return NextResponse.json({ error: 'Could not create your user profile. Try again.' }, { status: 500 })
  }

  // ── Resolve creator ──
  const { data: creatorRow } = await service
    .from('users')
    .select('id, username, is_creator, is_banned')
    .eq('id', requestedCreatorId)
    .maybeSingle()

  if (!creatorRow || !creatorRow.is_creator || creatorRow.is_banned) {
    return NextResponse.json({ error: 'Creator not found or unavailable' }, { status: 404 })
  }
  const creatorId = creatorRow.id
  const creatorUsername = creatorRow.username

  if (creatorId === subscriberId) {
    return NextResponse.json({ error: 'You cannot subscribe to yourself.' }, { status: 400 })
  }

  // ── Build invoice ──
  const plan    = PLANS[planId]
  const orderId = randomUUID()
  const host    = request.headers.get('host') ?? 'localhost:3000'
  const proto   = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  // Insert a pending payment; orderId lives in provider_payment_id so the
  // webhook can locate this row when NOWPayments echoes it back as order_id.
  const amountCents = Math.round(plan.price * 100)
  const { data: paymentRow, error: insertErr } = await service.from('payments').insert({
    payer_id:            subscriberId,
    payee_id:            creatorId,
    amount_cents:        amountCents,
    platform_fee_cents:  Math.round(amountCents * 0.15),
    currency:            'USD',
    status:              'pending',
    provider:            'crypto',
    provider_payment_id: orderId,
    purchase_plan_id:   planId,
  }).select('id').single()

  if (insertErr) {
    console.error('[create-invoice] DB insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to record payment. Try again.' }, { status: 500 })
  }

  let finalAmountCents = amountCents
  if (promoCode) {
    const { data: promo, error: promoError } = await service.rpc('reserve_promo_code_for_payment', { p_code: promoCode, p_user_id: subscriberId, p_payment_id: paymentRow.id, p_original_amount_cents: amountCents, p_currency: 'USD', p_purchase_type: 'subscription', p_target_id: creatorId })
    if (promoError || !promo?.[0]) {
      await service.from('payments').delete().eq('id', paymentRow.id)
      const message = promoError?.message?.includes('promo_code_inactive') ? 'Promo code is inactive' : promoError?.message?.includes('promo_code_expired') ? 'Promo code has expired' : promoError?.message?.includes('usage_limit') ? 'Promo code usage limit reached' : promoError?.message?.includes('minimum_purchase') ? 'Minimum purchase amount not reached' : 'Invalid promo code'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    finalAmountCents = promo[0].final_amount_cents
    await service.from('payments').update({ original_amount_cents: amountCents, amount_cents: finalAmountCents, discount_amount_cents: promo[0].discount_amount_cents, promo_code_id: promo[0].promo_code_id, promo_code_snapshot: promo[0].promo_code_snapshot, discount_percent: promo[0].discount_percent }).eq('id', paymentRow.id)
  }

  // ── Call NOWPayments ──
  let invoice
  try {
    invoice = await createInvoice({
      price_amount:      finalAmountCents / 100,
      price_currency:    'usd',
      order_id:          orderId,
      order_description: plan.label,
      success_url:       `${baseUrl}/${creatorUsername}?payment=success`,
      cancel_url:        `${baseUrl}/${creatorUsername}`,
      ipn_callback_url:  `${baseUrl}/api/payments/webhook`,
    })
  } catch (err) {
    console.error('[create-invoice] NOWPayments API error:', err)
    // Roll back the pending row so it doesn't orphan
    if (promoCode) await service.rpc('release_promo_redemption', { p_payment_id: paymentRow.id, p_status: 'failed' })
    await service.from('payments').delete().eq('provider_payment_id', orderId)
    return NextResponse.json({ error: 'Could not create crypto invoice. Try again.' }, { status: 502 })
  }

  return NextResponse.json({ invoice_url: invoice.invoice_url })
}
/* eslint-disable @typescript-eslint/no-explicit-any */
