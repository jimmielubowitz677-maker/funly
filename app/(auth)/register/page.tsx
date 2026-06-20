'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, Mail } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/auth/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })

    const warn = !res.ok
    // mode=register tells /verify to show the Set Password step after OTP success
    router.push(`/verify?email=${encodeURIComponent(email)}&mode=register${warn ? '&warn=1' : ''}`)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl">Funly</span>
      </div>

      <h1 className="text-2xl font-bold text-center mb-1">Create account</h1>
      <p className="text-zinc-500 text-sm text-center mb-8">
        Enter your email — we&apos;ll send you a 6-digit code
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-1"
        >
          <Mail className="w-4 h-4" />
          Send Verification Code
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500 mt-6">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-pink-400 hover:text-pink-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
