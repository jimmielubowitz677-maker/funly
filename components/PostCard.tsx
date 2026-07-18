'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageSquare, Share2, Lock, Eye, Play, Send, ChevronDown, ChevronUp } from 'lucide-react'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import Button from './ui/Button'
import MediaLightbox, { type LightboxItem } from './ui/MediaLightbox'
import { cn } from '@/lib/utils'
import { formatPublicationDate } from '@/lib/publication-date'

export type PostType = 'free' | 'premium' | 'ppv'

export interface Post {
  id: string
  creatorId: string
  creator: { name: string; username: string; initials: string; verified: boolean; avatarUrl?: string | null }
  content: string
  hasMedia: boolean
  mediaUrl?: string
  mediaItems?: LightboxItem[]
  mediaGradient?: string
  type: PostType
  ppvPrice?: number
  likes: number
  comments: number
  publishedAt: string | null
  commentsDisabled?: boolean
  displayLikeCount?: number | null
}

interface CommentRow {
  id: string
  body: string
  created_at: string
  user_id: string
  users: { username: string; display_name: string | null; avatar_url: string | null } | null
}

interface PostCardProps {
  post: Post
  isSubscribed: boolean
  unlockedPosts: Set<string>
  onUnlock: (id: string) => void
  onSubscribe: () => void
  loadingUnlock?: boolean
  userId?: string
  isLiked?: boolean
}

export default function PostCard({
  post, isSubscribed, unlockedPosts, onUnlock, onSubscribe, loadingUnlock, userId, isLiked: initialIsLiked = false,
}: PostCardProps) {
  const [liked,         setLiked]         = useState(initialIsLiked)
  const [likeCount,     setLikeCount]     = useState(post.displayLikeCount != null ? post.displayLikeCount : post.likes)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showComments,  setShowComments]  = useState(false)
  const [comments,      setComments]      = useState<CommentRow[] | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText,   setCommentText]   = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentCount,  setCommentCount]  = useState(post.comments)
  const [shareToast,    setShareToast]    = useState(false)

  const isLocked =
    (post.type === 'premium' && !isSubscribed) ||
    (post.type === 'ppv' && !isSubscribed && !unlockedPosts.has(post.id))

  const allMedia: LightboxItem[] =
    post.mediaItems?.length
      ? post.mediaItems
      : post.mediaUrl
        ? [{ url: post.mediaUrl, type: 'image' }]
        : []

  async function handleLike() {
    if (!userId) return
    setLiked(l => !l)
    setLikeCount(c => liked ? c - 1 : c + 1)
    try {
      const res  = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
      const data = await res.json() as { liked: boolean; count: number }
      setLiked(data.liked)
      // Only sync with DB count when no display override is set;
      // when override is active the optimistic +/-1 is the right display
      if (post.displayLikeCount == null) setLikeCount(data.count)
    } catch {
      setLiked(l => !l)
      setLikeCount(c => liked ? c + 1 : c - 1)
    }
  }

  async function toggleComments() {
    if (!showComments && comments === null) {
      setLoadingComments(true)
      try {
        const res  = await fetch(`/api/posts/${post.id}/comments`)
        const data = await res.json() as { comments: CommentRow[] }
        setComments(data.comments ?? [])
      } finally {
        setLoadingComments(false)
      }
    }
    setShowComments(v => !v)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || postingComment) return
    setPostingComment(true)
    try {
      const res  = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const data = await res.json() as { comment: CommentRow }
      if (res.ok) {
        setComments(prev => [...(prev ?? []), data.comment])
        setCommentCount(c => c + 1)
        setCommentText('')
      }
    } finally {
      setPostingComment(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/${post.creator.username}`
    if (navigator.share) {
      navigator.share({ url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    }
  }

  return (
    <>
      {lightboxIndex !== null && (
        <MediaLightbox items={allMedia} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors duration-200">
        {/* Header — links to creator profile */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link href={`/${post.creator.username}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Avatar initials={post.creator.initials} src={post.creator.avatarUrl} verified={post.creator.verified} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{post.creator.name}</span>
                <Badge variant={post.type} />
              </div>
              <span className="text-xs text-zinc-500">
                @{post.creator.username} · {formatPublicationDate(post.publishedAt)}
              </span>
            </div>
          </Link>
        </div>

        {/* Content */}
        <div className="px-5 pb-4">
          {isLocked ? (
            /* ── Locked post: full-image blur with overlay (no cropping) ── */
            <div className="relative rounded-xl overflow-hidden" style={{ minHeight: '220px' }}>
              {/* Blurred preview — full natural dimensions, no cropping */}
              {post.content && (
                <p className="text-zinc-400 text-sm leading-relaxed blur-md select-none pointer-events-none line-clamp-3 mb-2">
                  {post.content}
                </p>
              )}
              {post.hasMedia ? (
                allMedia[0] ? (
                  allMedia[0].type === 'video' ? (
                    <div className="w-full h-64 pointer-events-none bg-zinc-800 flex items-center justify-center" style={{ filter: 'blur(16px)' }}>
                      <Play className="w-10 h-10 text-zinc-600 fill-zinc-600" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={allMedia[0].url}
                      alt=""
                      className="w-full max-h-[32rem] object-contain pointer-events-none"
                      style={{ filter: 'blur(18px)', background: '#09090b' }}
                    />
                  )
                ) : (
                  <div className={cn('w-full h-64 pointer-events-none bg-gradient-to-br', post.mediaGradient ?? 'from-zinc-700 to-zinc-800')} style={{ filter: 'blur(16px)' }} />
                )
              ) : (
                <div className={cn('w-full h-40 bg-gradient-to-br', post.mediaGradient ?? 'from-zinc-800 to-zinc-900')} />
              )}

              {/* Overlay — centered panel on top of the blurred image */}
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <div className="bg-black/65 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 flex flex-col items-center gap-3 mx-4 w-full max-w-xs shadow-2xl">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-pink-400" />
                  </div>
                  {post.type === 'premium' ? (
                    <>
                      <div className="text-center">
                        <p className="font-semibold text-white text-sm">Premium Content</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Subscribe to unlock all premium posts</p>
                      </div>
                      <button
                        onClick={onSubscribe}
                        className="w-full py-2.5 px-5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 active:scale-[0.97] transition-all duration-150"
                      >
                        Subscribe — from $9.99/mo
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <p className="font-semibold text-white text-sm">Pay-Per-View Post</p>
                        <p className="text-xs text-zinc-400 mt-0.5">One-time unlock</p>
                      </div>
                      <Button variant="primary" size="sm" loading={loadingUnlock} onClick={() => onUnlock(post.id)}>
                        {loadingUnlock ? 'Redirecting…' : `Unlock for $${post.ppvPrice?.toFixed(2)}`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {post.content && (
                <p className="text-zinc-300 text-sm leading-relaxed">{post.content}</p>
              )}
              {post.hasMedia && (
                <MediaGrid items={allMedia} gradient={post.mediaGradient} onOpen={i => setLightboxIndex(i)} hasMedia={post.hasMedia} />
              )}
            </>
          )}
        </div>

        {/* ── Subscribe CTA on free/unlocked posts for non-subscribers ── */}
        {!isLocked && !isSubscribed && post.type === 'free' && (
          <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-xl border border-pink-500/20 bg-gradient-to-r from-pink-500/8 to-rose-500/8 px-4 py-3">
            <p className="text-xs text-zinc-300 leading-snug">
              <span className="font-semibold text-white">Unlock all exclusive content</span>
              <span className="text-zinc-500"> · from $9.99/mo</span>
            </p>
            <button
              onClick={onSubscribe}
              className="shrink-0 py-2 px-4 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 shadow-md shadow-pink-500/25 hover:shadow-pink-500/40 active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
            >
              Subscribe
            </button>
          </div>
        )}

        {/* Actions */}
        {!isLocked && (
          <>
            <div className="flex items-center gap-1 px-5 py-3 border-t border-zinc-800/60">
              <button
                onClick={handleLike}
                disabled={!userId}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  liked
                    ? 'text-pink-400 bg-pink-500/10'
                    : 'text-zinc-500 hover:text-pink-400 hover:bg-pink-500/10 disabled:opacity-40 disabled:cursor-default'
                )}
              >
                <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
                {likeCount.toLocaleString()}
              </button>

              {!post.commentsDisabled && (
                <button
                  onClick={toggleComments}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                    showComments ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10'
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  {commentCount.toLocaleString()}
                  {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              <div className="relative ml-auto">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                {shareToast && (
                  <div className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1 bg-zinc-700 text-white text-[11px] rounded-lg whitespace-nowrap pointer-events-none">
                    Link copied!
                  </div>
                )}
              </div>
            </div>

            {/* Comments section */}
            {!post.commentsDisabled && showComments && (
              <div className="border-t border-zinc-800/60 px-5 pb-5 pt-4">
                {loadingComments ? (
                  <p className="text-xs text-zinc-600 text-center py-2">Loading…</p>
                ) : (
                  <>
                    {(comments ?? []).length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-2 mb-3">No comments yet</p>
                    )}
                    <div className="flex flex-col gap-3 mb-3 max-h-48 overflow-y-auto">
                      {(comments ?? []).map(c => {
                        const uname = c.users?.display_name ?? c.users?.username ?? 'User'
                        const initials = uname.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U'
                        return (
                          <div key={c.id} className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0 mt-0.5">
                              {c.users?.avatar_url
                                ? <img src={c.users.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> // eslint-disable-line @next/next/no-img-element
                                : initials
                              }
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-zinc-300">{uname}</span>
                              <p className="text-xs text-zinc-400 leading-relaxed">{c.body}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {userId && (
                      <form onSubmit={handleComment} className="flex items-center gap-2">
                        <input
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          placeholder="Add a comment…"
                          maxLength={500}
                          disabled={postingComment}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50 disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={!commentText.trim() || postingComment}
                          className="w-8 h-8 shrink-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
                        >
                          <Send className="w-3.5 h-3.5 text-white" />
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Media grid ────────────────────────────────────────────────────────────────

interface MediaGridProps { items: LightboxItem[]; gradient?: string; hasMedia: boolean; onOpen: (i: number) => void }

function MediaGrid({ items, gradient, hasMedia, onOpen }: MediaGridProps) {
  if (items.length === 0) {
    return hasMedia ? (
      <div className={cn('mt-3 w-full h-56 rounded-xl flex items-center justify-center bg-gradient-to-br', gradient ?? 'from-zinc-700 to-zinc-800')}>
        <Eye className="w-8 h-8 text-white/20" />
      </div>
    ) : null
  }
  if (items.length === 1) {
    return (
      <button onClick={() => onOpen(0)} className="mt-3 block w-full overflow-hidden rounded-xl bg-black focus:outline-none cursor-zoom-in group">
        <MediaThumb item={items[0]} className="w-full h-auto max-h-none group-hover:scale-[1.01] transition-transform duration-200" />
      </button>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((item, i) => (
        <button key={i} onClick={() => onOpen(i)} className="block w-full overflow-hidden rounded-xl bg-black focus:outline-none cursor-zoom-in group">
          <MediaThumb item={item} className="w-full h-auto group-hover:scale-[1.01] transition-transform duration-200" />
        </button>
      ))}
    </div>
  )
}

function MediaThumb({ item, className }: { item: LightboxItem; className?: string }) {
  if (item.type === 'video') {
    return (
      <div className="relative bg-black">
        <video src={item.url} className={cn('block', className)} preload="metadata" playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Play className="w-10 h-10 text-white/80 fill-white/80 drop-shadow-lg" />
        </div>
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" className={className} draggable={false} />
}
