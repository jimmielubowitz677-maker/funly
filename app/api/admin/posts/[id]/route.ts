import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

interface NewMedia {
  url: string
  media_type: 'image' | 'video'
  file_name: string
  file_size_bytes: number
  sort_order: number
}

type PostUpdate = Database['public']['Tables']['posts']['Update']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { modelId, error } = await requireAdmin()
  if (error) return error

  const service = getSupabaseServiceClient()

  const { data: post } = await service.from('posts').select('*').eq('id', params.id).single()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.creator_id !== modelId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: media } = await service.from('media').select('*').eq('post_id', params.id).order('sort_order')

  return NextResponse.json({ post, media: media ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { userId, modelId, error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { title, body: postBody, post_type, ppv_price_cents, is_published, published_at, new_media, delete_media_ids, comments_disabled, display_like_count } = body
  const service = getSupabaseServiceClient()

  const { data: postRow } = await service.from('posts').select('creator_id,published_at').eq('id', params.id).maybeSingle()
  if (!postRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (postRow.creator_id !== modelId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const update: PostUpdate = {}
  if (title !== undefined) update.title = title?.trim() || null
  if (postBody !== undefined) update.body = postBody?.trim() || null
  if (post_type !== undefined) {
    update.post_type = post_type ?? 'free'
    update.is_premium = post_type !== 'free'
    update.ppv_price_cents = post_type === 'ppv' ? (ppv_price_cents ?? null) : null
  } else if (ppv_price_cents !== undefined) {
    update.ppv_price_cents = ppv_price_cents ?? null
  }
  if (typeof comments_disabled === 'boolean') update.comments_disabled = comments_disabled
  if (display_like_count !== undefined) update.display_like_count = display_like_count ?? null

  if (is_published !== undefined) {
    update.is_published = !!is_published
    if (!is_published) update.published_at = null
  }

  if (published_at !== undefined) {
    if (published_at === null) {
      update.published_at = null
    } else {
      if (typeof published_at !== 'string') {
        return NextResponse.json({ error: 'Invalid publication date' }, { status: 400 })
      }
      const parsed = new Date(published_at)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid publication date' }, { status: 400 })
      }
      update.published_at = parsed.toISOString()
    }
  } else if (is_published === true) {
    update.published_at = postRow.published_at ?? new Date().toISOString()
  }

  const { data: updatedPost, error: updateErr } = await service
    .from('posts')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr) {
    console.error('[admin/posts PATCH]', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Delete removed media
  if ((delete_media_ids as string[] | undefined)?.length) {
    const { data: toDelete } = await service
      .from('media')
      .select('id, url')
      .in('id', delete_media_ids as string[])

    if (toDelete?.length) {
      // Remove from Storage
      const paths = toDelete
        .map(m => m.url.split('/object/public/media/')[1])
        .filter(Boolean)
      if (paths.length) {
        await service.storage.from('media').remove(paths)
      }
      await service.from('media').delete().in('id', delete_media_ids as string[])
    }
  }

  // Insert new media
  if ((new_media as NewMedia[] | undefined)?.length) {
    const { data: existing } = await service.from('media').select('sort_order').eq('post_id', params.id).order('sort_order', { ascending: false }).limit(1)
    const startOrder = (existing?.[0]?.sort_order ?? -1) + 1

    await service.from('media').insert(
      (new_media as NewMedia[]).map((m, i) => ({
        post_id:         params.id,
        uploader_id:     userId!,
        media_type:      m.media_type,
        url:             m.url,
        file_name:       m.file_name,
        file_size_bytes: m.file_size_bytes,
        sort_order:      startOrder + i,
      }))
    )
  }

  return NextResponse.json({ post: updatedPost })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { modelId, error } = await requireAdmin()
  if (error) return error

  const service = getSupabaseServiceClient()

  const { data: postRow } = await service.from('posts').select('creator_id').eq('id', params.id).maybeSingle()
  if (!postRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (postRow.creator_id !== modelId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete media files from storage first
  const { data: mediaRows } = await service.from('media').select('url').eq('post_id', params.id)
  if (mediaRows?.length) {
    const paths = mediaRows.map(m => m.url.split('/object/public/media/')[1]).filter(Boolean)
    if (paths.length) await service.storage.from('media').remove(paths)
  }

  await service.from('posts').delete().eq('id', params.id)

  return NextResponse.json({ ok: true })
}
