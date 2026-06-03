'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Pencil, Trash2, Image as ImageIcon, Video, Loader2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface PostRow {
  id: string
  title: string | null
  post_type: 'free' | 'premium' | 'ppv'
  ppv_price_cents: number | null
  is_published: boolean
  created_at: string
  media_count: number
  has_video: boolean
}

interface PostsTableProps {
  posts: PostRow[]
}

export default function PostsTable({ posts }: PostsTableProps) {
  const router                    = useRouter()
  const [busy, setBusy]           = useState<string | null>(null)
  const [confirm, setConfirm]     = useState<string | null>(null)

  async function togglePublish(id: string, current: boolean) {
    setBusy(id)
    await fetch(`/api/admin/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    setBusy(null)
    router.refresh()
  }

  async function deletePost(id: string) {
    setBusy(id)
    setConfirm(null)
    await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    setBusy(null)
    router.refresh()
  }

  if (!posts.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-600 text-sm">No posts yet.</p>
        <Link href="/admin/posts/new" className="inline-block mt-3 text-xs text-pink-400 hover:text-pink-300 font-medium transition-colors">
          Create your first post →
        </Link>
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
          <th className="px-4 md:px-5 py-3 text-left font-medium">Post</th>
          <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Type</th>
          <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Status</th>
          <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">Media</th>
          <th className="px-4 md:px-5 py-3 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post, i) => (
          <tr
            key={post.id}
            className={cn(
              'hover:bg-zinc-800/30 transition-colors',
              i < posts.length - 1 && 'border-b border-zinc-800/60'
            )}
          >
            <td className="px-4 md:px-5 py-4">
              <span className="text-sm font-medium text-zinc-100 line-clamp-1">{post.title ?? '(untitled)'}</span>
              <span className="text-xs text-zinc-600 mt-0.5 block">{new Date(post.created_at).toLocaleDateString()}</span>
            </td>
            <td className="px-3 py-4 hidden sm:table-cell">
              <Badge variant={post.post_type} />
              {post.ppv_price_cents && (
                <span className="ml-1.5 text-xs text-zinc-500">${(post.ppv_price_cents / 100).toFixed(2)}</span>
              )}
            </td>
            <td className="px-3 py-4 hidden md:table-cell">
              <Badge variant={post.is_published ? 'published' : 'draft'} />
            </td>
            <td className="px-3 py-4 hidden lg:table-cell">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {post.media_count > 0 ? (
                  <>
                    {post.has_video ? <Video className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    {post.media_count}
                  </>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </div>
            </td>
            <td className="px-4 md:px-5 py-4">
              {confirm === post.id ? (
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs text-zinc-400">Delete?</span>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors font-medium"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirm(null)}
                    className="text-xs px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors font-medium"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 justify-end">
                  {busy === post.id ? (
                    <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                  ) : (
                    <>
                      <button
                        onClick={() => togglePublish(post.id, post.is_published)}
                        title={post.is_published ? 'Unpublish' : 'Publish'}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          post.is_published
                            ? 'text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10'
                            : 'text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                        )}
                      >
                        {post.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setConfirm(post.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
