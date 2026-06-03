'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import PostCard, { type Post } from '@/components/PostCard'

interface CreatorProfile {
  name: string
  username: string
  initials: string
  verified: boolean
  bio: string
  subscriberCount: number
  postCount: number
}

interface FeedClientProps {
  posts: Post[]
  creator: CreatorProfile
  isSubscribed: boolean
  unlockedPpvIds: string[]
  paymentStatus?: string
}

export default function FeedClient({
  posts,
  creator,
  isSubscribed,
  unlockedPpvIds,
  paymentStatus,
}: FeedClientProps) {
  const router = useRouter()

  const [unlockedPosts, setUnlockedPosts] = useState<Set<string>>(new Set(unlockedPpvIds))
  const [unlockingPostId, setUnlockingPostId] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (paymentStatus === 'success') {
      setSuccessMsg('Subscription activated! Premium content is now unlocked.')
      router.replace('/feed', { scroll: false })
    } else if (paymentStatus === 'ppv_success') {
      setSuccessMsg('Purchase complete! Your post is now unlocked.')
      router.replace('/feed', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400 flex-1">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unlock error toast */}
      {unlockError && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-red-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{unlockError}</p>
          <button onClick={() => setUnlockError(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Creator profile card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-r from-pink-500/25 via-rose-500/15 to-purple-600/25" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-7 mb-4 gap-2 flex-wrap">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-lg sm:text-xl font-bold text-white border-4 border-zinc-900 shadow-xl flex-shrink-0">
              {creator.initials}
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold border mb-1 flex-shrink-0 transition-all ${
                isSubscribed
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}
            >
              {isSubscribed ? '✓ Subscribed' : 'Not subscribed'}
            </span>
          </div>

          <h2 className="font-bold text-lg flex items-center gap-1.5">
            {creator.name}
            {creator.verified && (
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </h2>
          <p className="text-zinc-500 text-sm">@{creator.username}</p>
          {creator.bio && (
            <p className="text-zinc-400 text-sm mt-2">{creator.bio}</p>
          )}
          <div className="flex gap-4 sm:gap-5 mt-3 flex-wrap">
            <span className="text-xs sm:text-sm">
              <strong className="text-white">{creator.subscriberCount.toLocaleString()}</strong>{' '}
              <span className="text-zinc-500">subscribers</span>
            </span>
            <span className="text-xs sm:text-sm">
              <strong className="text-white">{creator.postCount}</strong>{' '}
              <span className="text-zinc-500">posts</span>
            </span>
          </div>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">No posts yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isSubscribed={isSubscribed}
              unlockedPosts={unlockedPosts}
              onUnlock={handleUnlock}
              onSubscribe={() => router.push('/subscriptions')}
              loadingUnlock={unlockingPostId === post.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
