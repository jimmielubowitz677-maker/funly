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

export async function POST(request: NextRequest) {
  const { userId, modelId, error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { title, body: postBody, post_type, ppv_price_cents, is_published, new_media } = body
  const service = getSupabaseServiceClient()

  const { data: post, error: postErr } = await service
    .from('posts')
    .insert({
      creator_id:      modelId!,
      title:           title?.trim() || null,
      body:            postBody?.trim() || null,
      post_type:       post_type ?? 'free',
      ppv_price_cents: post_type === 'ppv' ? (ppv_price_cents ?? null) : null,
      is_premium:      post_type !== 'free',
      is_published:    !!is_published,
      published_at:    is_published ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (postErr) {
    console.error('[admin/posts POST]', postErr)
    return NextResponse.json({ error: postErr.message }, { status: 500 })
  }

  if ((new_media as NewMedia[] | undefined)?.length) {
    await service.from('media').insert(
      (new_media as NewMedia[]).map((m, i) => ({
        post_id:         post.id,
        uploader_id:     userId!,
        media_type:      m.media_type,
        url:             m.url,
        file_name:       m.file_name,
        file_size_bytes: m.file_size_bytes,
        sort_order:      i,
      }))
    )
  }

  return NextResponse.json({ post }, { status: 201 })
}
