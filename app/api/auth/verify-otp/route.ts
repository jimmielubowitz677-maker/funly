import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { validateSessionResult } from '@/lib/auth/session-contract'

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
  const body  = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null
  const code  = typeof body?.code  === 'string' ? body.code.replace(/\D/g, '') : null

  console.log('[verify-otp] request', { codeLength: code?.length ?? 0 })

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
    console.warn('[verify-otp] verification rejected', {
      stage: 'otp_lookup',
      category: fetchError ? 'database_error' : 'invalid_or_expired_code',
      code: fetchError?.code ?? null,
    })
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  // Consume atomically so concurrent requests cannot both use the same code.
  const { data: consumedRecord, error: consumeError } = await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('id', record.id)
    .eq('used', false)
    .select('id')
    .maybeSingle()

  if (consumeError || !consumedRecord) {
    console.warn('[verify-otp] verification rejected', {
      stage: 'otp_consume',
      category: consumeError ? 'database_error' : 'already_used',
      code: consumeError?.code ?? null,
    })
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  // Generate a magic-link token via admin API, then immediately exchange it
  // for a real session server-side. This avoids PKCE flow issues on the client
  // when calling verifyOtp() directly from the browser.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[verify-otp] session creation failed', {
      stage: 'generate_link',
      category: 'auth_error',
      code: linkError?.code ?? null,
      status: linkError?.status ?? null,
      message: linkError?.message ?? 'Missing token hash',
    })
    return NextResponse.json(
      { success: false, error: 'Unable to complete sign in', code: 'SESSION_CREATION_FAILED' },
      { status: 500 }
    )
  }

  // Supabase documents token-hash verification with type "email". The returned
  // session contains real user tokens; the service-role key is never returned.
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  })
  const sessionResult = validateSessionResult(verifyData.session, verifyError)

  if (!sessionResult.ok) {
    console.error('[verify-otp] session creation failed', {
      stage: 'verify_otp',
      category: sessionResult.reason,
      code: verifyError?.code ?? null,
      status: verifyError?.status ?? null,
      message: verifyError?.message ?? null,
    })
    return NextResponse.json(
      { success: false, error: 'Unable to complete sign in', code: 'SESSION_CREATION_FAILED' },
      { status: 500 }
    )
  }

  // Ensure a public.users profile exists for this auth user
  const userId = sessionResult.userId ?? linkData.user.id
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user'
  const username = `${emailPrefix}_${userId.slice(0, 6)}`

  const { data: existingUser } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()
  const { error: upsertError } = await supabase.from('users').upsert(
    { id: userId, username, email, ...(existingUser ? {} : { first_login_post_eligible: true }) },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (upsertError) {
    console.error('[verify-otp] profile upsert failed', {
      stage: 'profile_upsert',
      category: 'database_error',
      code: upsertError.code,
      message: upsertError.message,
    })
  }

  return NextResponse.json({
    success: true,
    access_token: sessionResult.accessToken,
    refresh_token: sessionResult.refreshToken,
  })

  } catch (err: unknown) {
    console.error('[verify-otp] session creation failed', {
      stage: 'unhandled',
      category: 'server_error',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { success: false, error: 'Server configuration error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
