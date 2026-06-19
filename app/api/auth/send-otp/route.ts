import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createHash, randomInt } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'Funly <onboarding@resend.dev>'

function generateCode() {
  return randomInt(100_000, 1_000_000).toString()
}

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const code     = generateCode()
  const supabase = getSupabaseServiceClient()

  // Invalidate any existing unused codes for this email before inserting a new one
  await supabase.from('otp_codes').delete().eq('email', email).eq('used', false)

  const { error: dbError } = await supabase.from('otp_codes').insert({
    email,
    code_hash:  hashCode(code),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  if (dbError) {
    console.error('[send-otp] DB insert failed:', dbError.message)
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 })
  }

  const { error: emailError } = await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `${code} — your Funly sign-in code`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:480px;margin:40px auto;padding:0 20px;">
          <div style="margin-bottom:28px;">
            <span style="font-size:20px;font-weight:800;color:#fafafa;">Funly</span>
          </div>
          <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:36px 32px;margin-bottom:20px;">
            <p style="margin:0 0 6px;font-size:14px;color:#a1a1aa;font-weight:500;">Your sign-in code</p>
            <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:28px;text-align:center;margin:20px 0;">
              <span style="font-size:48px;font-weight:900;letter-spacing:12px;color:#ec4899;font-variant-numeric:tabular-nums;">${code}</span>
            </div>
            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.7;">
              This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.<br>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
          <p style="font-size:12px;color:#52525b;text-align:center;margin:0;">
            Sent to ${email} · © Funly
          </p>
        </div>
      </body>
      </html>
    `,
  })

  if (emailError) {
    console.error('[send-otp] Resend error:', emailError)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
