import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

// POST — accepts multipart/form-data, uploads images server-side with the
// service-role key (bypasses storage RLS), then updates the users table.
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAdmin()
  if (error) return error

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const displayName     = formData.get('display_name')     as string | null
  const username        = formData.get('username')          as string | null
  const bio             = formData.get('bio')               as string | null
  const currentAvatarUrl = formData.get('current_avatar_url') as string | null
  const currentBannerUrl = formData.get('current_banner_url') as string | null
  const avatarFile      = formData.get('avatar')            as File | null
  const bannerFile      = formData.get('banner')            as File | null

  // Validate username
  const uname = username?.trim() ?? ''
  if (!USERNAME_RE.test(uname)) {
    return NextResponse.json(
      { error: 'Username must be 3–30 characters: letters, numbers, and underscores only.' },
      { status: 422 }
    )
  }

  const service = getSupabaseServiceClient()

  // Check username uniqueness
  const { data: taken } = await service
    .from('users')
    .select('id')
    .eq('username', uname)
    .neq('id', userId!)
    .maybeSingle()

  if (taken) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
  }

  // Upload images server-side — service role bypasses all storage RLS
  let newAvatarUrl = currentAvatarUrl || null
  let newBannerUrl = currentBannerUrl || null

  if (avatarFile && avatarFile.size > 0) {
    const buffer = await avatarFile.arrayBuffer()
    const ext    = (avatarFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path   = `avatars/${userId}-${Date.now()}.${ext}`

    const { error: upErr } = await service.storage
      .from('media')
      .upload(path, buffer, { contentType: avatarFile.type, upsert: true })

    if (upErr) {
      console.error('[profile] avatar upload:', upErr)
      return NextResponse.json({ error: `Avatar upload failed: ${upErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('media').getPublicUrl(path)
    newAvatarUrl = publicUrl
  }

  if (bannerFile && bannerFile.size > 0) {
    const buffer = await bannerFile.arrayBuffer()
    const ext    = (bannerFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path   = `banners/${userId}-${Date.now()}.${ext}`

    const { error: upErr } = await service.storage
      .from('media')
      .upload(path, buffer, { contentType: bannerFile.type, upsert: true })

    if (upErr) {
      console.error('[profile] banner upload:', upErr)
      return NextResponse.json({ error: `Banner upload failed: ${upErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('media').getPublicUrl(path)
    newBannerUrl = publicUrl
  }

  // Persist everything to public.users
  type UserUpdate = {
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    banner_url: string | null
  }

  const updates: UserUpdate = {
    username:     uname,
    display_name: displayName?.trim() || null,
    bio:          bio?.trim()         || null,
    avatar_url:   newAvatarUrl,
    banner_url:   newBannerUrl,
  }

  const { error: dbErr } = await service
    .from('users')
    .update(updates)
    .eq('id', userId!)

  if (dbErr) {
    console.error('[profile] db update:', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success:    true,
    avatar_url: newAvatarUrl,
    banner_url: newBannerUrl,
  })
}
