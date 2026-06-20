import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null
  const code  = typeof body?.code  === 'string' ? body.code.replace(/\D/g, '') : null

  if (!email || !code || code.length !== 6) {
    return NextResponse.json({ error: 'Email and 6-digit code are required' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  // Find a matching, unused, non-expired record
  const { data: record, error: fetchError } = await supabase
    .from('otp_codes')
    .select('id')
    .eq('email', email)
    .eq('code_hash', hashCode(code))
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  // Consume the code immediately — prevents replay attacks
  await supabase.from('otp_codes').update({ used: true }).eq('id', record.id)

  // Generate a magic-link token via admin API, then immediately exchange it
  // for a real session server-side. This avoids PKCE flow issues on the client
  // when calling verifyOtp() directly from the browser.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[verify-otp] generateLink failed — error:', JSON.stringify(linkError))
    console.error('[verify-otp] generateLink linkData:', JSON.stringify(linkData))
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  console.log('[verify-otp] generateLink ok — hashed_token present, exchanging...')

  // Exchange the token for a real session server-side
  const verifyRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      }),
    }
  )

  const rawText = await verifyRes.text()
  console.log('[verify-otp] /auth/v1/verify status:', verifyRes.status, 'body:', rawText)

  let session: { access_token?: string; refresh_token?: string; user?: { id: string } }
  try {
    session = JSON.parse(rawText)
  } catch {
    console.error('[verify-otp] response was not JSON')
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  if (!session.access_token || !session.refresh_token) {
    console.error('[verify-otp] session exchange missing tokens — full response:', session)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Ensure a public.users profile exists for this auth user
  const userId = session.user?.id ?? linkData.user.id
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user'
  const username = `${emailPrefix}_${userId.slice(0, 6)}`

  await supabase.from('users').upsert(
    { id: userId, username, email },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  return NextResponse.json({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
  })
}
