'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, X, Loader2, Crown, Star, Sparkles, Check } from 'lucide-react'
import PostCard, { type Post } from '@/components/PostCard'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface CreatorInfo {
  id: string
  name: string
  username: string
  initials: string
  verified: boolean
  bio: string
  avatarUrl: string | null
  bannerUrl: string | null
  subscriberCount: number
  postCount: number
}

interface CreatorProfileClientProps {
  creator: CreatorInfo
  posts: Post[]
  isSubscribed: boolean
  unlockedPpvIds: string[]
  viewerId: string
  paymentStatus?: string
}

const PLANS = [
  {
    id: 'fan',
    name: 'Fan',
    price: 9.99,
    period: 'month',
    description: 'Perfect to get started',
    icon: Star,
    features: ['Access to all premium posts', 'Exclusive photos & videos', 'Early access to new content', 'Cancel anytime'],
  },
  {
    id: 'superfan',
    name: 'Superfan',
    price: 19.99,
    period: 'month',
    description: 'Most popular choice',
    icon: Sparkles,
    highlighted: true,
    badge: 'Most Popular',
    features: ['Everything in Fan', 'VIP direct messages', 'Exclusive live streams', '20% discount on PPV posts', 'Priority responses'],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 49.99,
    period: 'month',
    description: 'Ultimate fan experience',
    icon: Crown,
    features: ['Everything in Superfan', 'Unlimited direct messages', 'Custom content requests', 'Free access to all PPV posts', 'Monthly 1-on-1 video call'],
  },
]

export default function CreatorProfileClient({ creator, posts, isSubscribed, unlockedPpvIds, viewerId, paymentStatus }: CreatorProfileClientProps) {
  const router = useRouter()
  const [unlockedPosts] = useState<Set<string>>(new Set(unlockedPpvIds))
  const [unlockingPostId, setUnlockingPostId] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  // Build subscription set (single creator here, so just one ID)
  const subscribedCreatorIds = useMemo(() => new Set(isSubscribed ? [creator.id] : []), [isSubscribed, creator.id])

  // Handle payment=success redirect
  useEffect(() => {
    if (paymentStatus !== 'success') return
    router.replace(`/${creator.username}`, { scroll: false })

    if (isSubscribed) {
      setSuccessMsg('Subscription activated! Premium content is now unlocked.')
      return
    }

    setPaymentProcessing(true)
    let pollCount = 0
    const MAX_POLLS = 40

    const interval = setInterval(() => {
      pollCount++
      if (pollCount >= MAX_POLLS) {
        clearInterval(interval)
        setPaymentProcessing(false)
        setPollTimedOut(true)
        return
      }
      router.refresh()
    }, 3000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (paymentProcessing && isSubscribed) {
      setPaymentProcessing(false)
      setSuccessMsg('Subscription activated! Premium content is now unlocked.')
    }
  }, [isSubscribed, paymentProcessing])

  async function handleSubscribe(planId: string) {
    setLoadingPlan(planId)
    setPlanError(null)
    try {
      const res = await fetch('/api/payments/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, creatorId: creator.id }),
      })
      const data = await res.json() as { invoice_url?: string; error?: string }
      if (!res.ok || !data.invoice_url) {
        setPlanError(data.error ?? 'Failed to create payment. Please try again.')
        setLoadingPlan(null)
        return
      }
      window.location.href = data.invoice_url
    } catch {
      setPlanError('Network error. Please try again.')
      setLoadingPlan(null)
    }
  }

  async function handleUnlock(id: string) {
    setUnlockingPostId(id)
    setUnlockError(null)
    try {
      const res = await fetch('/api/payments/unlock-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      const data = await res.json() as { invoice_url?: string; error?: string }
      if (!res.ok || !data.invoice_url) {
        setUnlockError(data.error ?? 'Failed to create payment. Please try again.')
        setUnlockingPostId(null)
        return
      }
      window.location.href = data.invoice_url
    } catch {
      setUnlockError('Network error. Please try again.')
      setUnlockingPostId(null)
    }
  }

  // Determine if this is the creator viewing their own profile
  const isOwnProfile = viewerId === creator.id

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Payment confirming banner */}
      {paymentProcessing && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <Loader2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <p className="text-sm text-amber-400 font-medium">Confirming payment…</p>
            <p className="text-xs text-zinc-500 mt-0.5">This usually takes under a minute.</p>
          </div>
        </div>
      )}
      {pollTimedOut && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-zinc-300 font-medium">Payment is still processing</p>
            <p className="text-xs text-zinc-500 mt-0.5">Crypto confirmations can take a few minutes. Refresh to check.</p>
          </div>
          <button onClick={() => setPollTimedOut(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400 flex-1">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
      {unlockError && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-red-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{unlockError}</p>
          <button onClick={() => setUnlockError(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Creator profile card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
        <div className="relative h-32 sm:h-40 bg-gradient-to-r from-pink-500/25 via-rose-500/15 to-purple-600/25">
          {creator.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-8 mb-4 gap-3 flex-wrap">
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 overflow-hidden flex items-center justify-center text-xl font-bold text-white border-4 border-zinc-900 shadow-xl shrink-0">
              {creator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
              ) : (
                creator.initials
              )}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border mb-1 shrink-0 ${
              isSubscribed ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}>
              {isSubscribed ? '✓ Subscribed' : isOwnProfile ? '👑 Your Profile' : 'Not subscribed'}
            </span>
          </div>
          <h1 className="font-bold text-xl flex items-center gap-1.5">
            {creator.name}
            {creator.verified && (
              <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </h1>
          <p className="text-zinc-500 text-sm">@{creator.username}</p>
          {creator.bio && <p className="text-zinc-400 text-sm mt-2">{creator.bio}</p>}
          <div className="flex gap-4 mt-3">
            <span className="text-xs sm:text-sm"><strong className="text-white">{creator.subscriberCount.toLocaleString()}</strong> <span className="text-zinc-500">subscribers</span></span>
            <span className="text-xs sm:text-sm"><strong className="text-white">{creator.postCount}</strong> <span className="text-zinc-500">posts</span></span>
          </div>
        </div>
      </div>

      {/* Subscription plans — shown only to non-subscribers who aren't the creator */}
      {!isSubscribed && !isOwnProfile && (
        <div className="mb-6">
          {planError && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-zinc-900 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{planError}</p>
            </div>
          )}
          <h2 className="text-lg font-bold mb-4">Subscribe to {creator.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map(plan => {
              const Icon = plan.icon
              return (
                <div key={plan.id} className={cn(
                  'relative flex flex-col rounded-2xl border p-5 transition-all',
                  plan.highlighted
                    ? 'border-pink-500/50 bg-gradient-to-b from-pink-500/10 to-zinc-900 shadow-lg shadow-pink-500/10'
                    : 'border-zinc-800 bg-zinc-900'
                )}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-pink-500 to-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', plan.highlighted ? 'bg-pink-500/20' : 'bg-zinc-800')}>
                      <Icon className={cn('w-4 h-4', plan.highlighted ? 'text-pink-400' : 'text-zinc-400')} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{plan.name}</p>
                      <p className="text-[10px] text-zinc-500">{plan.description}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-2xl font-black text-white">${plan.price}</span>
                    <span className="text-zinc-500 text-xs ml-1">/{plan.period}</span>
                  </div>
                  <ul className="flex flex-col gap-1.5 mb-4 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlighted ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Redirecting…</span>
                    ) : 'Subscribe Now'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">No posts yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isSubscribed={subscribedCreatorIds.has(post.creatorId)}
              unlockedPosts={unlockedPosts}
              onUnlock={handleUnlock}
              onSubscribe={() => {}} // already on the creator page, plan cards are above
              loadingUnlock={unlockingPostId === post.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
