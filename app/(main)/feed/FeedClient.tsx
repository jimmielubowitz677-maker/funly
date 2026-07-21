'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, X, Compass } from 'lucide-react'
import PostCard, { type Post } from '@/components/PostCard'
import { useOnlineStatuses } from '@/lib/use-online-statuses'

interface FeedClientProps {
  posts: (Post & { _section: 'subscribed' | 'discover' })[]
  subscribedCreatorIds: string[]
  unlockedPpvIds: string[]
  userId?: string
  likedPostIds?: string[]
  hasSubscriptions?: boolean
  initialPersonalPost?: (Post & { _section: 'personal' }) | null
  initialPersonalAnimationShown?: boolean
  initialPersonalDelayMs?: number
}

export default function FeedClient({
  posts,
  subscribedCreatorIds,
  unlockedPpvIds,
  userId,
  likedPostIds = [],
  hasSubscriptions = false,
  initialPersonalPost = null,
  initialPersonalAnimationShown = true,
  initialPersonalDelayMs = 1000,
}: FeedClientProps) {
  const likedSet      = useMemo(() => new Set(likedPostIds), [likedPostIds])
  const subscribedSet = useMemo(() => new Set(subscribedCreatorIds), [subscribedCreatorIds])
  const router        = useRouter()

  const [unlockedPosts]    = useState<Set<string>>(new Set(unlockedPpvIds))
  const [unlockingPostId, setUnlockingPostId] = useState<string | null>(null)
  const [unlockError,     setUnlockError]     = useState<string | null>(null)
  const [personalPost, setPersonalPost] = useState(initialPersonalPost)
  const [personalVisible, setPersonalVisible] = useState(!!initialPersonalPost && initialPersonalAnimationShown)
  const [personalEntering, setPersonalEntering] = useState(false)
  const initialStatuses = useMemo(() => Object.fromEntries([...posts, ...(initialPersonalPost ? [initialPersonalPost] : [])].map(p => [p.creatorId, !!p.isOnline])), [posts, initialPersonalPost])
  const { statuses } = useOnlineStatuses(initialStatuses)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      if (initialPersonalPost && initialPersonalAnimationShown) return
      let post = initialPersonalPost
      let delay = initialPersonalDelayMs
      if (!post) {
        const res = await fetch('/api/feed/first-login', { method: 'POST' })
        const data = await res.json().catch(() => ({})) as { created?: boolean; post?: Post & { _section: 'personal' }; animationDelayMs?: number }
        if (!data.created || !data.post || cancelled) return
        post = { ...data.post, isPersonalDelivery: true }
        delay = data.animationDelayMs ?? 1000
        setPersonalPost(post)
      }
      timer = setTimeout(() => {
        if (cancelled) return
        setPersonalVisible(true); setPersonalEntering(true)
        setTimeout(() => setPersonalEntering(false), 650)
        setTimeout(() => { void fetch('/api/feed/first-login', { method: 'PATCH' }) }, 700)
      }, delay)
    }
    void load()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [initialPersonalAnimationShown, initialPersonalDelayMs, initialPersonalPost])

  async function handleUnlock(id: string) {
    setUnlockingPostId(id)
    setUnlockError(null)
    try {
      const res  = await fetch('/api/payments/unlock-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const subscribedPosts = posts.filter(p => p._section === 'subscribed')
  const discoveryPosts  = posts.filter(p => p._section === 'discover')

  function renderPost(post: Post & { _section: 'subscribed' | 'discover' }) {
    return (
      <PostCard
        key={post.id}
        post={{ ...post, isOnline: statuses[post.creatorId] ?? post.isOnline }}
        isSubscribed={subscribedSet.has(post.creatorId)}
        unlockedPosts={unlockedPosts}
        onUnlock={handleUnlock}
        onSubscribe={() => router.push(`/${post.creator.username}`)}
        loadingUnlock={unlockingPostId === post.id}
        userId={userId}
        isLiked={likedSet.has(post.id)}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {unlockError && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 flex items-start gap-3 rounded-xl border border-red-500/30 bg-zinc-900 shadow-2xl shadow-black/60 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{unlockError}</p>
          <button onClick={() => setUnlockError(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {personalPost && personalVisible && <div className={`mb-4 overflow-hidden first-login-post ${personalEntering ? 'first-login-post-enter' : ''}`}><PostCard post={{ ...personalPost, isOnline: statuses[personalPost.creatorId] ?? personalPost.isOnline }} isSubscribed={subscribedSet.has(personalPost.creatorId)} unlockedPosts={unlockedPosts} onUnlock={handleUnlock} onSubscribe={() => router.push(`/${personalPost.creator.username}`)} userId={userId} isLiked={likedSet.has(personalPost.id)} /></div>}
      {posts.length === 0 && !personalPost ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-zinc-600 text-sm">No posts yet.</p>
          <Link href="/subscriptions" className="inline-flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 font-medium transition-colors">
            <Compass className="w-4 h-4" />
            Discover creators to follow
          </Link>
        </div>
      ) : (
        <>
          {/* ── Subscribed section ── */}
          {subscribedPosts.length > 0 && (
            <div className="mb-8">
              <h1 className="text-xl font-bold mb-4">Following</h1>
              <div className="flex flex-col gap-4">
                {subscribedPosts.map(renderPost)}
              </div>
            </div>
          )}

          {/* ── Discovery section ── */}
          {discoveryPosts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-4 h-4 text-zinc-500" />
                <h2 className={`font-bold ${hasSubscriptions ? 'text-base text-zinc-400' : 'text-xl text-white'}`}>
                  {hasSubscriptions ? 'Discover More' : 'Latest Posts'}
                </h2>
              </div>
              <div className="flex flex-col gap-4">
                {discoveryPosts.map(renderPost)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
