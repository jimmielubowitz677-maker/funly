'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import PostCard, { type Post } from '@/components/PostCard'

interface FeedClientProps {
  posts: Post[]
  subscribedCreatorIds: string[]
  unlockedPpvIds: string[]
  userId?: string
  likedPostIds?: string[]
}

export default function FeedClient({
  posts,
  subscribedCreatorIds,
  unlockedPpvIds,
  userId,
  likedPostIds = [],
}: FeedClientProps) {
  const likedSet = useMemo(() => new Set(likedPostIds), [likedPostIds])
  const router = useRouter()

  const [unlockedPosts] = useState<Set<string>>(new Set(unlockedPpvIds))
  const [unlockingPostId, setUnlockingPostId] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  const subscribedSet = useMemo(() => new Set(subscribedCreatorIds), [subscribedCreatorIds])

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

      <div className="mb-6">
        <h1 className="text-xl font-bold">Latest Posts</h1>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">No posts yet — check back soon.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isSubscribed={subscribedSet.has(post.creatorId)}
              unlockedPosts={unlockedPosts}
              onUnlock={handleUnlock}
              onSubscribe={() => router.push(`/${post.creator.username}`)}
              loadingUnlock={unlockingPostId === post.id}
              userId={userId}
              isLiked={likedSet.has(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
