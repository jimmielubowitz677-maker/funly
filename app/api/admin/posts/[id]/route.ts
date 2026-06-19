import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

interface NewMedia {
  url: string
  media_type: 'image' | 'video'
  file_name: string
  file_size_bytes: number
  sort_order: number
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const service = getSupabaseServiceClient()

  const { data: post } = await service.from('posts').select('*').eq('id', params.id).single()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: media } = await service.from('media').select('*').eq('post_id', params.id).order('sort_order')

  return NextResponse.json({ post, media: media ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { userId, modelId, error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { title, body: postBody, post_type, ppv_price_cents, is_published, new_media, delete_media_ids } = body
  const service = getSupabaseServiceClient()

  const { data: postRow } = await service.from('posts').select('creator_id').eq('id', params.id).maybeSingle()
  if (!postRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (postRow.creator_id !== modelId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error: updateErr } = await service
    .from('posts')
    .update({
      title:           title?.trim() || null,
      body:            postBody?.trim() || null,
      post_type:       post_type ?? 'free',
      ppv_price_cents: post_type === 'ppv' ? (ppv_price_cents ?? null) : null,
      is_premium:      post_type !== 'free',
      is_published:    !!is_published,
      published_at:    is_published ? new Date().toISOString() : null,
    })
    .eq('id', params.id)

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

  return NextResponse.json({ ok: true })
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
