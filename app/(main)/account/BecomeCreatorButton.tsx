'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'

type Step = 'cta' | 'terms' | 'loading'

export default function BecomeCreatorButton() {
  const router   = useRouter()
  const [step, setStep]       = useState<Step>('cta')
  const [agreed, setAgreed]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleAccept() {
    if (!agreed) return
    setStep('loading')
    setError(null)
    try {
      const res  = await fetch('/api/account/become-creator', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ termsAccepted: true }),
      })
      const data = await res.json() as { success?: boolean; already?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setStep('terms')
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setStep('terms')
    }
  }

  if (step === 'cta') {
    return (
      <Button variant="primary" size="sm" onClick={() => setStep('terms')}>
        Become a Creator
      </Button>
    )
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 mt-2">
      <div className="flex items-start gap-2.5">
        <CheckCircle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide">Creator Agreement</p>
      </div>

      <div className="text-sm text-zinc-300 space-y-2 leading-relaxed">
        <p>By becoming a creator on Funly you agree to the following terms:</p>
        <ul className="list-disc list-inside text-zinc-400 space-y-1.5 ml-1">
          <li>The platform retains a <strong className="text-white">15% commission</strong> on all earnings (subscriptions, PPV, tips).</li>
          <li>You are responsible for complying with all applicable laws and regulations regarding your content.</li>
          <li>Content must not violate the platform's content policy (no illegal material, no minors).</li>
          <li>Payouts are processed after the platform fee is deducted from your gross earnings.</li>
          <li>The platform may suspend or terminate creator access for policy violations.</li>
        </ul>
      </div>

      <div className="pt-1">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              agreed ? 'bg-pink-500 border-pink-500' : 'bg-zinc-900 border-zinc-600 group-hover:border-zinc-400'
            }`}>
              {agreed && (
                <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-zinc-300 leading-snug">
            I have read and agree to the creator terms, including the <strong className="text-white">15% platform commission</strong> on all earnings.
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={!agreed || step === 'loading'}
          loading={step === 'loading'}
          onClick={handleAccept}
        >
          Accept &amp; Continue
        </Button>
        <button
          type="button"
          onClick={() => { setStep('cta'); setAgreed(false); setError(null) }}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
