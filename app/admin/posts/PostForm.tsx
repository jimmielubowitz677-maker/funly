'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Video, Loader2, Plus, AlertCircle, Eye, EyeOff, ZoomIn } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import MediaLightbox, { type LightboxItem } from '@/components/ui/MediaLightbox'
import { cn } from '@/lib/utils'

interface ExistingMedia {
  id: string
  url: string
  media_type: string
  file_name: string | null
}

interface PostData {
  id: string
  title: string | null
  body: string | null
  post_type: 'free' | 'premium' | 'ppv'
  ppv_price_cents: number | null
  is_published: boolean
  published_at?: string | null
  created_at?: string
  comments_disabled?: boolean
  display_like_count?: number | null
}

interface PostFormProps {
  mode?: 'create' | 'edit'
  post?: PostData
  existingMedia?: ExistingMedia[]
}

interface QueuedFile {
  file: File
  preview: string | null
  uploading: boolean
  uploaded: boolean
  url: string | null
}

const TYPE_LABELS = { free: 'Free', premium: 'Premium', ppv: 'Pay-Per-View' } as const
const TYPE_DESC   = {
  free:    'Visible to everyone, no subscription needed',
  premium: 'Requires an active subscription to view',
  ppv:     'Individual unlock purchase, separate from subscription',
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)

  return localDate.toISOString().slice(0, 16)
}

export default function PostForm({ mode = 'create', post, existingMedia = [] }: PostFormProps) {
  const router = useRouter()

  const [title,              setTitle]              = useState(post?.title ?? '')
  const [body,               setBody]               = useState(post?.body ?? '')
  const [postType,           setPostType]           = useState<'free' | 'premium' | 'ppv'>(post?.post_type ?? 'free')
  const [ppvPrice,           setPpvPrice]           = useState(post?.ppv_price_cents ? String(post.ppv_price_cents / 100) : '')
  const [commentsDisabled,   setCommentsDisabled]   = useState(post?.comments_disabled ?? false)
  const [displayLikeCount,   setDisplayLikeCount]   = useState(post?.display_like_count != null ? String(post.display_like_count) : '')
  const initialPublishedAt = post?.published_at ?? post?.created_at ?? new Date().toISOString()
  const [publishedAt,        setPublishedAt]        = useState(toDatetimeLocal(initialPublishedAt))
  const isPublished = post?.is_published ?? false

  const [queued,        setQueued]        = useState<QueuedFile[]>([])
  const [keptMedia,     setKeptMedia]     = useState<ExistingMedia[]>(existingMedia)
  const [deletedIds,    setDeletedIds]    = useState<string[]>([])
  const [dragActive,    setDragActive]    = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  function openLightbox(items: LightboxItem[], index: number) {
    setLightboxItems(items)
    setLightboxIndex(index)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    const valid = Array.from(list).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    setQueued(prev => [
      ...prev,
      ...valid.map(file => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        uploading: false,
        uploaded:  false,
        url:       null,
      })),
    ])
  }

  function removeQueued(i: number) {
    setQueued(prev => {
      const copy = [...prev]
      if (copy[i].preview) URL.revokeObjectURL(copy[i].preview!)
      copy.splice(i, 1)
      return copy
    })
  }

  function removeExisting(id: string) {
    setKeptMedia(prev => prev.filter(m => m.id !== id))
    setDeletedIds(prev => [...prev, id])
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragActive(true) }, [])
  const onDragLeave = useCallback(() => setDragActive(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files)
  }, [])

  async function handleSubmit(publish: boolean) {
    if (postType === 'ppv' && (!ppvPrice || parseFloat(ppvPrice) <= 0)) {
      setError('Enter a price for Pay-Per-View posts.')
      return
    }
    setSubmitting(true)
    setError(null)

    const supabase    = getSupabaseBrowserClient()
    const uploadedMedia: Array<{ url: string; media_type: 'image' | 'video'; file_name: string; file_size_bytes: number; sort_order: number }> = []

    for (let i = 0; i < queued.length; i++) {
      const { file } = queued[i]
      setQueued(prev => prev.map((q, idx) => idx === i ? { ...q, uploading: true } : q))

      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
      if (upErr) {
        setError(`Upload failed for ${file.name}: ${upErr.message}`)
        setSubmitting(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      setQueued(prev => prev.map((q, idx) => idx === i ? { ...q, uploading: false, uploaded: true, url: publicUrl } : q))

      uploadedMedia.push({
        url:             publicUrl,
        media_type:      file.type.startsWith('image/') ? 'image' : 'video',
        file_name:       file.name,
        file_size_bytes: file.size,
        sort_order:      keptMedia.length + i,
      })
    }

    const endpoint = mode === 'create' ? '/api/admin/posts' : `/api/admin/posts/${post!.id}`
    const method   = mode === 'create' ? 'POST' : 'PATCH'

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:               title.trim() || null,
        body:                body.trim() || null,
        post_type:           postType,
        ppv_price_cents:     postType === 'ppv' ? Math.round(parseFloat(ppvPrice) * 100) : null,
        is_published:        publish,
        new_media:           uploadedMedia,
        delete_media_ids:    deletedIds,
        comments_disabled:   commentsDisabled,
        display_like_count:  displayLikeCount !== '' ? parseInt(displayLikeCount, 10) : null,
        published_at:        publishedAt ? new Date(publishedAt).toISOString() : null,
      }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Failed to save post. Try again.')
      setSubmitting(false)
      return
    }

    router.push('/admin/posts')
    router.refresh()
  }

  const hasMedia = keptMedia.length > 0 || queued.length > 0

  return (
    <>
      {lightboxIndex !== null && (
        <MediaLightbox
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">{mode === 'create' ? 'New Post' : 'Edit Post'}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {mode === 'create' ? 'Upload media and fill in the details' : 'Update your post content and settings'}
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* ── Media upload ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Media</h2>

          {hasMedia ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
              {keptMedia.map((m, mi) => {
                // Build combined list for lightbox navigation: kept media first, then uploaded queued
                const allItems: LightboxItem[] = [
                  ...keptMedia.map(k => ({ url: k.url, type: k.media_type as 'image' | 'video' })),
                  ...queued.filter(q => q.url).map(q => ({ url: q.url!, type: (q.file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video' })),
                ]
                return (
                  <div key={m.id} className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-square group">
                    {m.media_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1.5 p-2">
                        <Video className="w-7 h-7 text-zinc-400" />
                        <p className="text-[10px] text-zinc-500 text-center line-clamp-2">{m.file_name}</p>
                      </div>
                    )}
                    {/* Expand button */}
                    <button
                      type="button"
                      onClick={() => openLightbox(allItems, mi)}
                      className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-zinc-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ZoomIn className="w-3 h-3 text-white" />
                    </button>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeExisting(m.id)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )
              })}

              {queued.map((q, i) => {
                const allItems: LightboxItem[] = [
                  ...keptMedia.map(k => ({ url: k.url, type: k.media_type as 'image' | 'video' })),
                  ...queued.filter(q => q.url).map(q => ({ url: q.url!, type: (q.file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video' })),
                ]
                const queuedOffset = keptMedia.length
                const isExpandable = !!(q.preview || q.url)
                return (
                  <div key={i} className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-square group">
                    {q.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1.5 p-2">
                        <Video className="w-7 h-7 text-zinc-400" />
                        <p className="text-[10px] text-zinc-500 text-center line-clamp-2">{q.file.name}</p>
                      </div>
                    )}
                    {q.uploading && (
                      <div className="absolute inset-0 bg-zinc-900/70 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                      </div>
                    )}
                    {!q.uploading && (
                      <>
                        {isExpandable && q.url && (
                          <button
                            type="button"
                            onClick={() => openLightbox(allItems, queuedOffset + i)}
                            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-zinc-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ZoomIn className="w-3 h-3 text-white" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeQueued(i)}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] text-zinc-500">Add more</span>
              </button>
            </div>
          ) : (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                dragActive ? 'border-pink-500 bg-pink-500/5' : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
              )}
            >
              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400 font-medium">Drop files here or click to upload</p>
              <p className="text-xs text-zinc-600 mt-1">JPG, PNG, GIF, WebP, MP4, MOV — max 50 MB each</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {/* ── Content ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Content</h2>

          <Input
            id="title"
            label="Title"
            placeholder="Give your post a title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-300">Description</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write a caption or description…"
              rows={4}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors resize-none"
            />
          </div>
        </div>

        {/* ── Access type ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Access Level</h2>

          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as Array<keyof typeof TYPE_LABELS>).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setPostType(t)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all border',
                  postType === t
                    ? 'bg-pink-500 border-pink-600 text-white shadow-md shadow-pink-500/20'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-500">{TYPE_DESC[postType]}</p>

          {postType === 'ppv' && (
            <Input
              id="ppv-price"
              label="Price (USD)"
              type="number"
              min="0.50"
              step="0.01"
              placeholder="4.99"
              value={ppvPrice}
              onChange={e => setPpvPrice(e.target.value)}
              className="max-w-[140px]"
            />
          )}
        </div>

        {/* ── Creator controls ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Creator Controls</h2>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={commentsDisabled}
              onClick={() => setCommentsDisabled(v => !v)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors shrink-0',
                commentsDisabled ? 'bg-pink-500' : 'bg-zinc-700'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                commentsDisabled ? 'translate-x-4' : 'translate-x-0'
              )} />
            </button>
            <div>
              <p className="text-sm font-medium text-zinc-200">Disable comments</p>
              <p className="text-xs text-zinc-500">Hides the comment section on this post</p>
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="display-like-count" className="text-sm font-medium text-zinc-300">
                Custom like count display
              </label>
              <input
                id="display-like-count"
                type="number"
                min="0"
                placeholder={`Leave blank to show real count`}
                value={displayLikeCount}
                onChange={e => setDisplayLikeCount(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
              />
              <p className="text-xs text-zinc-500">Overrides the displayed like count without changing real likes</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="published_at" className="text-sm font-medium text-zinc-300">
                Дата и время публикации
              </label>
              <input
                id="published_at"
                name="published_at"
                type="datetime-local"
                value={publishedAt}
                onChange={e => setPublishedAt(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="md"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
          >
            {isPublished ? (
              <><EyeOff className="w-4 h-4" /> Unpublish</>
            ) : (
              <><Eye className="w-4 h-4" /> Save Draft</>
            )}
          </Button>

          <Button
            variant="primary"
            size="md"
            loading={submitting}
            onClick={() => handleSubmit(true)}
          >
            {mode === 'create' ? 'Publish' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}
