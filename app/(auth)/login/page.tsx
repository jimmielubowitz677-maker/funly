'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lollipop, Mail, Eye, EyeOff, KeyRound } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPw]   = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [useOtp, setUseOtp]         = useState(false)

  function switchMode(otp: boolean) {
    setUseOtp(otp)
    setError(null)
    setPassword('')
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Nudge passwordless users toward OTP
      const hint = error.message.toLowerCase().includes('invalid')
        ? 'Invalid email or password. Try signing in with an email code instead.'
        : error.message
      setError(hint)
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  async function handleOtpLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })

    const warn = !res.ok
    router.push(`/verify?email=${encodeURIComponent(email)}${warn ? '&warn=1' : ''}`)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
          <Lollipop className="w-5 h-5 text-white" style={{ transform: 'rotate(25deg)' }} />
        </div>
        <span className="font-bold text-xl">Funly</span>
      </div>

      <h1 className="text-2xl font-bold text-center mb-1">Welcome back</h1>
      <p className="text-zinc-500 text-sm text-center mb-6">
        {useOtp ? "We'll send a 6-digit sign-in code to your email" : 'Sign in to your account'}
      </p>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-xl p-1 mb-6">
        <button
          type="button"
          onClick={() => switchMode(false)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            !useOtp ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <KeyRound className="w-3.5 h-3.5" />
          Password
        </button>
        <button
          type="button"
          onClick={() => switchMode(true)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            useOtp ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Mail className="w-3.5 h-3.5" />
          Email code
        </button>
      </div>

      {!useOtp ? (
        /* ── Password form ── */
        <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
          <Input
            id="email-pw"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          <div className="relative">
            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 bottom-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}{' '}
              {error.includes('email code') && (
                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className="underline hover:text-red-300 transition-colors"
                >
                  Switch now
                </button>
              )}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-1">
            Sign In
          </Button>
        </form>
      ) : (
        /* ── OTP form ── */
        <form onSubmit={handleOtpLogin} className="flex flex-col gap-4">
          <Input
            id="email-otp"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-1">
            <Mail className="w-4 h-4" />
            Send Sign-In Code
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-zinc-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-pink-400 hover:text-pink-300 font-medium transition-colors">
          Create one
        </Link>
      </p>
    </div>
  )
}
