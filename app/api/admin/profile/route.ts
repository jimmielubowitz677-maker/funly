import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

export async function POST(request: NextRequest) {
  const { userId, modelId, error } = await requireAdmin()
  console.log('[profile] requireAdmin ->', { userId, modelId, hasError: !!error })
  if (error) return error

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    console.log('[profile] formData parse error:', e)
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const displayName      = formData.get('display_name')      as string | null
  const username         = formData.get('username')           as string | null
  const bio              = formData.get('bio')                as string | null
  const currentAvatarUrl = formData.get('current_avatar_url') as string | null
  const currentBannerUrl = formData.get('current_banner_url') as string | null
  const avatarFile       = formData.get('avatar')             as File | null
  const bannerFile       = formData.get('banner')             as File | null

  console.log('[profile] FormData fields ->', {
    displayName,
    username,
    bio,
    currentAvatarUrl,
    currentBannerUrl,
    avatarFile: avatarFile ? `File(name=${avatarFile.name}, size=${avatarFile.size}, type=${avatarFile.type})` : null,
    bannerFile: bannerFile ? `File(name=${bannerFile.name}, size=${bannerFile.size}, type=${bannerFile.type})` : null,
  })

  const uname = username?.trim() ?? ''
  if (!USERNAME_RE.test(uname)) {
    console.log('[profile] username validation failed:', uname)
    return NextResponse.json(
      { error: 'Username must be 3–30 characters: letters, numbers, and underscores only.' },
      { status: 422 }
    )
  }

  const service = getSupabaseServiceClient()

  const { data: taken } = await service
    .from('users')
    .select('id')
    .eq('username', uname)
    .neq('id', modelId!)
    .maybeSingle()

  console.log('[profile] username uniqueness check ->', { uname, taken })
  if (taken) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
  }

  let newAvatarUrl = currentAvatarUrl || null
  let newBannerUrl = currentBannerUrl || null

  // ── Avatar upload ──
  if (avatarFile && avatarFile.size > 0) {
    console.log('[profile] uploading avatar...')
    const buffer = await avatarFile.arrayBuffer()
    const ext    = (avatarFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path   = `avatars/${modelId}-${Date.now()}.${ext}`
    console.log('[profile] avatar storage path:', path)

    const { data: uploadData, error: upErr } = await service.storage
      .from('media')
      .upload(path, buffer, { contentType: avatarFile.type, upsert: true })

    console.log('[profile] avatar upload result ->', { uploadData, upErr })

    if (upErr) {
      return NextResponse.json({ error: `Avatar upload failed: ${upErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('media').getPublicUrl(path)
    console.log('[profile] avatar publicUrl ->', publicUrl)
    newAvatarUrl = publicUrl
  } else {
    console.log('[profile] no avatar file, keeping existing:', newAvatarUrl)
  }

  // ── Banner upload ──
  if (bannerFile && bannerFile.size > 0) {
    console.log('[profile] uploading banner...')
    const buffer = await bannerFile.arrayBuffer()
    const ext    = (bannerFile.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path   = `banners/${modelId}-${Date.now()}.${ext}`
    console.log('[profile] banner storage path:', path)

    const { data: uploadData, error: upErr } = await service.storage
      .from('media')
      .upload(path, buffer, { contentType: bannerFile.type, upsert: true })

    console.log('[profile] banner upload result ->', { uploadData, upErr })

    if (upErr) {
      return NextResponse.json({ error: `Banner upload failed: ${upErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = service.storage.from('media').getPublicUrl(path)
    console.log('[profile] banner publicUrl ->', publicUrl)
    newBannerUrl = publicUrl
  } else {
    console.log('[profile] no banner file, keeping existing:', newBannerUrl)
  }

  // ── DB write ──
  const updates = {
    username:     uname,
    display_name: displayName?.trim() || null,
    bio:          bio?.trim()         || null,
    avatar_url:   newAvatarUrl,
    banner_url:   newBannerUrl,
  }

  console.log('[profile] writing to DB ->', { modelId, updates })

  const { data: dbData, error: dbErr } = await service
    .from('users')
    .update(updates)
    .eq('id', modelId!)
    .select('id, username, avatar_url, banner_url')

  console.log('[profile] DB update result ->', { dbData, dbErr })

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // ── Verify the row actually changed ──
  const { data: verifyRow, error: verifyErr } = await service
    .from('users')
    .select('id, username, avatar_url, banner_url')
    .eq('id', modelId!)
    .maybeSingle()

  console.log('[profile] post-update DB verify ->', { verifyRow, verifyErr })

  return NextResponse.json({
    success:    true,
    avatar_url: newAvatarUrl,
    banner_url: newBannerUrl,
  })
}
