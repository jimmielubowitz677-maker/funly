'use client'

import { useState } from 'react'
import { Heart, MessageSquare, Share2, Lock, Eye } from 'lucide-react'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { cn } from '@/lib/utils'

export type PostType = 'free' | 'premium' | 'ppv'

export interface Post {
  id: string
  creator: { name: string; username: string; initials: string; verified: boolean }
  content: string
  hasMedia: boolean
  mediaUrl?: string
  mediaGradient?: string
  type: PostType
  ppvPrice?: number
  likes: number
  comments: number
  timestamp: string
}

interface PostCardProps {
  post: Post
  isSubscribed: boolean
  unlockedPosts: Set<string>
  onUnlock: (id: string) => void
  onSubscribe: () => void
  loadingUnlock?: boolean
}

export default function PostCard({ post, isSubscribed, unlockedPosts, onUnlock, onSubscribe, loadingUnlock }: PostCardProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes)

  const isLocked =
    (post.type === 'premium' && !isSubscribed) ||
    (post.type === 'ppv' && !isSubscribed && !unlockedPosts.has(post.id))

  function handleLike() {
    setLiked(l => !l)
    setLikeCount(c => (liked ? c - 1 : c + 1))
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Avatar initials={post.creator.initials} verified={post.creator.verified} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{post.creator.name}</span>
              <Badge variant={post.type} />
            </div>
            <span className="text-xs text-zinc-500">
              @{post.creator.username} · {post.timestamp}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        {isLocked ? (
          <div className="relative">
            {/* Blurred preview */}
            <p className="text-zinc-400 text-sm leading-relaxed blur-sm select-none pointer-events-none line-clamp-3">
              {post.content}
            </p>
            {post.hasMedia && (
              post.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mediaUrl} alt="" className="mt-3 w-full h-56 rounded-xl object-cover blur-sm pointer-events-none" />
              ) : (
                <div className={cn('mt-3 w-full h-56 rounded-xl blur-sm pointer-events-none bg-gradient-to-br', post.mediaGradient ?? 'from-zinc-700 to-zinc-800')} />
              )
            )}

            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900/10 via-zinc-950/75 to-zinc-950 -mx-5 px-5 py-8">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Lock className="w-5 h-5 text-pink-400" />
              </div>

              {post.type === 'premium' ? (
                <>
                  <div className="text-center">
                    <p className="font-semibold text-white">Premium Content</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Subscribe to unlock all premium posts</p>
                  </div>
                  <Button variant="primary" size="sm" onClick={onSubscribe}>
                    Subscribe — from $9.99/mo
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="font-semibold text-white">Pay-Per-View Post</p>
                    <p className="text-xs text-zinc-500 mt-0.5">One-time unlock for this exclusive post</p>
                  </div>
                  <Button variant="primary" size="sm" loading={loadingUnlock} onClick={() => onUnlock(post.id)}>
                    {loadingUnlock ? 'Redirecting…' : `Unlock for $${post.ppvPrice?.toFixed(2)}`}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-zinc-300 text-sm leading-relaxed">{post.content}</p>
            {post.hasMedia && (
              post.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mediaUrl} alt="" className="mt-3 w-full h-56 rounded-xl object-cover" />
              ) : (
                <div className={cn('mt-3 w-full h-56 rounded-xl flex items-center justify-center bg-gradient-to-br', post.mediaGradient ?? 'from-zinc-700 to-zinc-800')}>
                  <Eye className="w-8 h-8 text-white/20" />
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {!isLocked && (
        <div className="flex items-center gap-1 px-5 pb-5 pt-3 border-t border-zinc-800/60">
          <button
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              liked
                ? 'text-pink-400 bg-pink-500/10'
                : 'text-zinc-500 hover:text-pink-400 hover:bg-pink-500/10'
            )}
          >
            <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
            {likeCount.toLocaleString()}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-200">
            <MessageSquare className="w-4 h-4" />
            {post.comments.toLocaleString()}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      )}
    </div>
  )
}
