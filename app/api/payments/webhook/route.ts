import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/nowpayments'

const SUBSCRIPTION_DAYS = 30

// Map price in cents to plan tier (matches PLANS in create-invoice route)
const CENTS_TO_PLAN: Record<number, string> = {
  999:  'fan',
  1999: 'superfan',
  4999: 'vip',
}

interface NowPaymentsEvent {
  payment_id:     number | string
  payment_status: string
  order_id:       string
  price_amount:   number
  actually_paid?: number
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-nowpayments-sig') ?? ''
  const secret = process.env.NOWPAYMENTS_IPN_SECRET ?? ''

  if (!secret) {
    console.error('[webhook] NOWPAYMENTS_IPN_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as NowPaymentsEvent
  const { payment_id, payment_status, order_id, price_amount } = event

  const service = getSupabaseServiceClient()

  // Locate the pending payment created during invoice creation
  const { data: payment } = await service
    .from('payments')
    .select('*')
    .eq('provider_payment_id', order_id)
    .maybeSingle()

  if (!payment) {
    // Unknown order — acknowledge so NOWPayments stops retrying
    return NextResponse.json({ received: true })
  }

  if (payment_status === 'finished' || payment_status === 'confirmed') {
    // Replace the temporary order UUID with the real NOWPayments payment ID
    await service
      .from('payments')
      .update({ status: 'completed', provider_payment_id: String(payment_id) })
      .eq('id', payment.id)

    // PPV post unlock — payment is complete, no subscription to create
    if (payment.post_id) {
      return NextResponse.json({ received: true })
    }

    const amountCents = Math.round(price_amount * 100)
    const planId = CENTS_TO_PLAN[amountCents] ?? 'fan'
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + SUBSCRIPTION_DAYS)

    const { data: existing } = await service
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', payment.payer_id)
      .eq('creator_id', payment.payee_id)
      .maybeSingle()

    if (existing) {
      await service
        .from('subscriptions')
        .update({
          status:               'active',
          price_paid_cents:     payment.amount_cents,
          current_period_start: now.toISOString(),
          current_period_end:   periodEnd.toISOString(),
          cancelled_at:         null,
          plan_id:              planId,
        })
        .eq('id', existing.id)

      await service
        .from('payments')
        .update({ subscription_id: existing.id })
        .eq('id', payment.id)
    } else {
      const { data: newSub } = await service
        .from('subscriptions')
        .insert({
          subscriber_id:        payment.payer_id,
          creator_id:           payment.payee_id,
          status:               'active',
          price_paid_cents:     payment.amount_cents,
          current_period_end:   periodEnd.toISOString(),
          plan_id:              planId,
        })
        .select('id')
        .single()

      if (newSub) {
        await service
          .from('payments')
          .update({ subscription_id: newSub.id })
          .eq('id', payment.id)
      }
    }
  } else if (payment_status === 'failed' || payment_status === 'expired') {
    await service
      .from('payments')
      .update({ status: 'failed', provider_payment_id: String(payment_id || order_id) })
      .eq('id', payment.id)
  } else if (payment_status === 'refunded') {
    await service
      .from('payments')
      .update({
        status:              'refunded',
        provider_payment_id: String(payment_id),
        refunded_at:         new Date().toISOString(),
      })
      .eq('id', payment.id)
  }

  return NextResponse.json({ received: true })
}
