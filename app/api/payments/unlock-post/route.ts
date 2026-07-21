import { randomUUID } from 'crypto'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { createInvoice } from '@/lib/nowpayments'

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

async function ensureProfile(
  service: ServiceClient,
  authUserId: string,
): Promise<string | null> {
  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle()

  if (existing) return authUserId

  const { data: authData } = await service.auth.admin.getUserById(authUserId)
  const authUser = authData?.user
  if (!authUser?.email) return null

  const email = authUser.email
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user'
  const username = `${prefix}_${authUserId.slice(0, 6)}`

  const { error } = await service.from('users').insert({ id: authUserId, username, email })
  if (error && error.code !== '23505') return null

  return authUserId
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const postId = (body as { postId?: string; promoCode?: string } | null)?.postId
  const promoCode = (body as { promoCode?: string } | null)?.promoCode?.trim() || null

  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Please sign in to unlock this post.' }, { status: 401 })
  }

  const service = getSupabaseServiceClient() as any

  // Fetch the post — must be PPV and published
  const { data: post } = await service
    .from('posts')
    .select('id, title, post_type, ppv_price_cents, creator_id, is_published')
    .eq('id', postId)
    .maybeSingle()

  if (!post || !post.is_published || post.post_type !== 'ppv') {
    return NextResponse.json({ error: 'Post not found or not available for purchase.' }, { status: 404 })
  }

  if (!post.ppv_price_cents || post.ppv_price_cents <= 0) {
    return NextResponse.json({ error: 'This post has no price set.' }, { status: 400 })
  }

  const creatorId = post.creator_id

  // Prevent self-purchase
  if (user.id === creatorId) {
    return NextResponse.json({ error: 'You cannot purchase your own post.' }, { status: 400 })
  }

  // Check if already unlocked
  const { data: existingPayment } = await service
    .from('payments')
    .select('id')
    .eq('payer_id', user.id)
    .eq('post_id', postId)
    .eq('status', 'completed')
    .maybeSingle()

  if (existingPayment) {
    return NextResponse.json({ error: 'You have already unlocked this post.' }, { status: 409 })
  }

  // Ensure subscriber profile
  const subscriberId = await ensureProfile(service, user.id)
  if (!subscriberId) {
    return NextResponse.json({ error: 'Could not create your user profile. Try again.' }, { status: 500 })
  }

  // Build invoice
  const orderId = randomUUID()
  const host = request.headers.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  const { data: paymentRow, error: insertErr } = await service.from('payments').insert({
    payer_id:            subscriberId,
    payee_id:            creatorId,
    post_id:             postId,
    amount_cents:        post.ppv_price_cents,
    currency:            'USD',
    status:              'pending',
    provider:            'crypto',
    provider_payment_id: orderId,
  }).select('id').single()

  if (insertErr) {
    console.error('[unlock-post] DB insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to record payment. Try again.' }, { status: 500 })
  }

  let finalAmountCents = post.ppv_price_cents
  if (promoCode) {
    const { data: promo, error: promoError } = await service.rpc('reserve_promo_code_for_payment', { p_code: promoCode, p_user_id: user.id, p_payment_id: paymentRow.id, p_original_amount_cents: post.ppv_price_cents, p_currency: 'USD', p_purchase_type: 'ppv', p_target_id: postId })
    if (promoError || !promo?.[0]) {
      await service.from('payments').delete().eq('id', paymentRow.id)
      const message = promoError?.message?.includes('promo_code_inactive') ? 'Promo code is inactive' : promoError?.message?.includes('promo_code_expired') ? 'Promo code has expired' : promoError?.message?.includes('usage_limit') ? 'Promo code usage limit reached' : promoError?.message?.includes('minimum_purchase') ? 'Minimum purchase amount not reached' : 'Invalid promo code'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    finalAmountCents = promo[0].final_amount_cents
    await service.from('payments').update({ original_amount_cents: post.ppv_price_cents, amount_cents: finalAmountCents, discount_amount_cents: promo[0].discount_amount_cents, promo_code_id: promo[0].promo_code_id, promo_code_snapshot: promo[0].promo_code_snapshot, discount_percent: promo[0].discount_percent }).eq('id', paymentRow.id)
  }

  let invoice
  try {
    invoice = await createInvoice({
      price_amount:      finalAmountCents / 100,
      price_currency:    'usd',
      order_id:          orderId,
      order_description: `PPV Unlock — ${post.title ?? 'Exclusive Post'}`,
      success_url:       `${baseUrl}/feed?payment=ppv_success`,
      cancel_url:        `${baseUrl}/feed`,
      ipn_callback_url:  `${baseUrl}/api/payments/webhook`,
    })
  } catch (err) {
    console.error('[unlock-post] NOWPayments error:', err)
    if (promoCode) await service.rpc('release_promo_redemption', { p_payment_id: paymentRow.id, p_status: 'failed' })
    await service.from('payments').delete().eq('provider_payment_id', orderId)
    return NextResponse.json({ error: 'Could not create crypto invoice. Try again.' }, { status: 502 })
  }

  return NextResponse.json({ invoice_url: invoice.invoice_url })
}
/* eslint-disable @typescript-eslint/no-explicit-any */
