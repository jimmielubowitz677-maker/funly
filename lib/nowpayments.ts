import { createHmac } from 'crypto'

const BASE_URL = 'https://api.nowpayments.io/v1'

function apiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY
  if (!key) throw new Error('NOWPAYMENTS_API_KEY is not set')
  return key
}

export interface CreateInvoiceParams {
  price_amount: number
  price_currency: string
  order_id: string
  order_description: string
  success_url: string
  cancel_url: string
  ipn_callback_url: string
}

export interface InvoiceResponse {
  id: string
  invoice_url: string
  status: string
}

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
  const res = await fetch(`${BASE_URL}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `NOWPayments error ${res.status}`)
  }

  return res.json() as Promise<InvoiceResponse>
}

// NOWPayments signs IPN payloads with HMAC-SHA512 over a key-sorted JSON body.
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>
  const sorted = Object.fromEntries(Object.keys(parsed).sort().map(k => [k, parsed[k]]))
  const expected = createHmac('sha512', secret).update(JSON.stringify(sorted)).digest('hex')
  return expected === signature
}
