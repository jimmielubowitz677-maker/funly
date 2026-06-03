'use client'

import { useState } from 'react'
import { Lock, MessageCircle, Sparkles, Users, X, AlertCircle } from 'lucide-react'
import PlanCard, { type Plan } from '@/components/PlanCard'

const PLANS: Plan[] = [
  {
    id: 'fan',
    name: 'Fan',
    price: 9.99,
    period: 'month',
    description: 'Perfect to get started',
    icon: 'star',
    features: [
      'Access to all premium posts',
      'Exclusive photos & videos',
      'Early access to new content',
      'Cancel anytime',
    ],
  },
  {
    id: 'superfan',
    name: 'Superfan',
    price: 19.99,
    period: 'month',
    description: 'Most popular choice',
    icon: 'sparkles',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      'Everything in Fan',
      'VIP direct messages',
      'Exclusive live streams',
      '20% discount on PPV posts',
      'Priority comment responses',
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 49.99,
    period: 'month',
    description: 'Ultimate fan experience',
    icon: 'crown',
    features: [
      'Everything in Superfan',
      'Unlimited direct messages',
      'Custom content requests',
      'Free access to all PPV posts',
      'Monthly 1-on-1 video call',
      'Name in creator credits',
    ],
  },
]

const PERKS = [
  { icon: Lock,          title: 'Unlock Premium Content', description: 'Access hundreds of exclusive photos and videos' },
  { icon: MessageCircle, title: 'Direct Messages',        description: 'Chat directly with your favorite creator'       },
  { icon: Sparkles,      title: 'Exclusive Perks',        description: 'Early access, discounts, and special events'   },
  { icon: Users,         title: 'Community Access',       description: 'Join an exclusive community of true fans'       },
]

export default function SubscriptionsPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(id: string) {
    setLoadingPlan(id)
    setError(null)

    try {
      const res = await fetch('/api/payments/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: id }),
      })

      const data = await res.json() as { invoice_url?: string; error?: string }

      if (!res.ok || !data.invoice_url) {
        setError(data.error ?? 'Failed to create payment. Please try again.')
        setLoadingPlan(null)
        return
      }

      // Hard navigate so the browser leaves this page and goes to NOWPayments
      window.location.href = data.invoice_url
    } catch {
      setError('Network error. Please try again.')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Exclusive Membership
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Choose Your Plan
        </h1>
        <p className="text-zinc-400 text-lg max-w-lg mx-auto">
          Get unlimited access to exclusive content from Sofia Rose. Cancel anytime.
        </p>
      </div>

      {/* Error toast — fixed so it's always visible regardless of scroll position */}
      {error && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50
                        flex items-start gap-3 rounded-xl border border-red-500/30 bg-zinc-900
                        shadow-2xl shadow-black/60 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14 items-start">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isLoading={loadingPlan === plan.id}
            disabled={loadingPlan !== null}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Why subscribe */}
      <div className="border-t border-zinc-800 pt-10">
        <h2 className="text-xl font-bold text-center mb-6">Why subscribe?</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {PERKS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-zinc-600">
        <span>🔒 Secure payment</span>
        <span>✦ Cancel anytime</span>
        <span>₿ All major cryptocurrencies accepted</span>
        <span>🛡️ Privacy protected</span>
      </div>
    </div>
  )
}
