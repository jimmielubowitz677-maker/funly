import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

async function getAdmin() {
  const supabase = await getSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = getSupabaseServiceClient(); const { data } = await service.from('users').select('id').eq('owner_id', user.id).eq('is_creator', true).limit(1)
  return data?.length ? user : null
}

export async function PATCH(request: NextRequest) {
  const user = await getAdmin(); if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null); const delay = Number(body?.animation_delay_ms)
  if (typeof body?.enabled !== 'boolean' || (body?.post_id !== null && typeof body?.post_id !== 'string') || !Number.isInteger(delay) || delay < 500 || delay > 3000) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  const service = getSupabaseServiceClient()
  if (body.post_id) { const { data: post } = await service.from('posts').select('id,users!posts_creator_id_fkey(owner_id)').eq('id', body.post_id).maybeSingle(); if (!post || (post.users as unknown as { owner_id:string|null }).owner_id !== user.id) return NextResponse.json({ error: 'Select a post from one of your models' }, { status: 403 }) }
  const { data: existing } = await service.from('first_login_campaigns').select('id').limit(1).maybeSingle()
  const values = { enabled: body.enabled, post_id: body.post_id || null, animation_delay_ms: delay }
  const query = existing ? service.from('first_login_campaigns').update(values).eq('id', existing.id) : service.from('first_login_campaigns').insert(values)
  const { data, error } = await query.select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function POST() {
  const user = await getAdmin(); if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const service = getSupabaseServiceClient(); const { data: campaign } = await service.from('first_login_campaigns').select('*').limit(1).maybeSingle()
  if (!campaign?.post_id) return NextResponse.json({ error: 'Save a post first' }, { status: 400 })
  await service.from('first_login_deliveries').delete().eq('user_id', user.id)
  const { error } = await service.from('first_login_deliveries').insert({ user_id:user.id, campaign_id:campaign.id, post_id:campaign.post_id, is_test:true })
  if (error) return NextResponse.json({ error:error.message }, { status:500 }); return NextResponse.json({ ok:true })
}
