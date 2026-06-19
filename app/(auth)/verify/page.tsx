'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Crown, Eye, EyeOff, KeyRound, RotateCcw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const RESEND_DELAY = 60

function VerifyContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const email        = searchParams.get('email') ?? ''
  const isRegister   = searchParams.get('mode') === 'register'
  const supabase     = getSupabaseBrowserClient()

  // ── OTP step state ──
  const [otp, setOtp]             = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [countdown, setCountdown] = useState(RESEND_DELAY)
  const [resending, setResending] = useState(false)
  const inputRefs                 = useRef<(HTMLInputElement | null)[]>([])

  // ── Set-password step state (register only) ──
  const [showPwStep, setShowPwStep]   = useState(false)
  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [pwLoading, setPwLoading]     = useState(false)
  const [pwError, setPwError]         = useState<string | null>(null)

  // ── Countdown timer ──
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── Auto-submit when all 6 digits filled ──
  useEffect(() => {
    if (otp.every(d => d !== '') && !loading) handleVerify(otp.join(''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  // ── OTP input handlers ──
  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next  = [...otp]; next[i] = digit; setOtp(next)
    setError(null)
    if (digit && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otp[i]) { const n = [...otp]; n[i] = ''; setOtp(n) }
      else if (i > 0) inputRefs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && i > 0) inputRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = Array(6).fill('')
    pasted.split('').forEach((ch, idx) => { next[idx] = ch })
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  // ── Verify OTP ──
  async function handleVerify(code: string) {
    if (code.length < 6 || loading) return
    setLoading(true); setError(null)

    const res  = await fetch('/api/auth/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Invalid or expired code')
      setOtp(Array(6).fill(''))
      setLoading(false)
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      return
    }

    // Use setSession instead of verifyOtp — the server already exchanged the
    // magic-link token for a real session, so we just store the tokens here.
    // This avoids PKCE flow issues that cause verifyOtp to fail silently.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
    })

    if (sessionError) { setError(sessionError.message); setLoading(false); return }

    // Registration flow → show optional Set Password step
    // Login flow → go straight to feed
    if (isRegister) {
      setShowPwStep(true)
      setLoading(false)
    } else {
      router.push('/feed')
      router.refresh()
    }
  }

  // ── Resend OTP ──
  async function handleResend() {
    setResending(true); setError(null)
    await fetch('/api/auth/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResending(false); setCountdown(RESEND_DELAY)
    setOtp(Array(6).fill(''))
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }

  // ── Set password ──
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)

    if (password.length < 8)        { setPwError('Password must be at least 8 characters'); return }
    if (password !== confirmPw)      { setPwError("Passwords don't match"); return }

    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) { setPwError(error.message); setPwLoading(false); return }

    router.push('/feed')
    router.refresh()
  }

  function skipToFeed() { router.push('/feed'); router.refresh() }

  // ── Guards ──
  if (!email) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 text-center">
        <p className="text-zinc-500 text-sm mb-4">Missing email address.</p>
        <Link href="/register" className="text-pink-400 hover:text-pink-300 text-sm font-medium transition-colors">
          ← Back to register
        </Link>
      </div>
    )
  }

  // ── Set Password step (register only) ──
  if (showPwStep) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">Funly</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3 text-emerald-400">
                <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xs text-zinc-500">Verified</span>
          </div>
          <div className="flex-1 h-px bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-xs font-bold text-pink-400">
              2
            </span>
            <span className="text-xs text-white font-medium">Set password</span>
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center mx-auto mb-5">
          <KeyRound className="w-6 h-6 text-pink-400" />
        </div>

        <h1 className="text-xl font-bold text-center mb-1">Set a password</h1>
        <p className="text-zinc-500 text-sm text-center mb-6">
          Optional but recommended — lets you sign in faster next time
        </p>

        <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
          <div className="relative">
            <Input
              id="new-password"
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 bottom-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Input
            id="confirm-password"
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />

          {pwError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {pwError}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={pwLoading} className="w-full mt-1">
            Set Password &amp; Continue
          </Button>
        </form>

        <button
          onClick={skipToFeed}
          className="w-full mt-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center"
        >
          Skip for now →
        </button>
      </div>
    )
  }

  // ── OTP entry step ──
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl">Funly</span>
      </div>

      {/* Step indicator for registration */}
      {isRegister && (
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-xs font-bold text-pink-400">
              1
            </span>
            <span className="text-xs text-white font-medium">Verify email</span>
          </div>
          <div className="flex-1 h-px bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">
              2
            </span>
            <span className="text-xs text-zinc-500">Set password</span>
          </div>
        </div>
      )}

      <div className="w-16 h-16 rounded-2xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center mx-auto mb-5">
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-pink-400">
          <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-center mb-1">Check your email</h1>
      <p className="text-zinc-500 text-sm text-center mb-1">We sent a 6-digit code to</p>
      <p className="font-semibold text-sm text-center text-white mb-8 truncate px-4">{email}</p>

      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 mb-5" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            autoFocus={i === 0}
            className={cn(
              'w-10 h-12 sm:w-11 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border bg-zinc-950',
              'transition-all duration-150 outline-none disabled:opacity-40',
              digit
                ? 'border-pink-500 text-white shadow-md shadow-pink-500/20'
                : 'border-zinc-700 text-white focus:border-pink-500/60 focus:shadow-md focus:shadow-pink-500/10'
            )}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 text-center mb-4">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        loading={loading}
        disabled={otp.some(d => !d)}
        className="w-full"
        onClick={() => handleVerify(otp.join(''))}
      >
        Verify Code
      </Button>

      <div className="mt-5 text-center">
        {countdown > 0 ? (
          <p className="text-xs text-zinc-500">
            Resend code in{' '}
            <span className="text-zinc-300 font-semibold tabular-nums">{countdown}s</span>
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', resending && 'animate-spin')} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link
          href={isRegister ? '/register' : '/login'}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isRegister ? 'Back to register' : 'Back to sign in'}
        </Link>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/40 flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
