// REQUIRED DB MIGRATION (run once in Supabase SQL editor):
//   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
//   UPDATE public.users SET owner_id = id WHERE is_creator = true AND owner_id IS NULL;

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = getSupabaseServiceClient()
  const { data: models } = await service
    .from('users')
    .select('id, username, display_name, avatar_url, bio, created_at')
    .eq('owner_id', user.id)
    .eq('is_creator', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({ models: models ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const uname        = (body.username ?? '').trim()
  const display_name = (body.display_name ?? '').trim() || null

  if (!USERNAME_RE.test(uname)) {
    return NextResponse.json(
      { error: 'Username must be 3–30 characters: letters, numbers, underscores only.' },
      { status: 422 },
    )
  }

  const service = getSupabaseServiceClient()

  const { data: taken } = await service
    .from('users')
    .select('id')
    .eq('username', uname)
    .maybeSingle()

  if (taken) return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 })

  const newId = randomUUID()
  const { data: newModel, error: insertErr } = await service
    .from('users')
    .insert({
      id:           newId,
      owner_id:     user.id,
      is_creator:   true,
      username:     uname,
      display_name,
      email:        `model_${newId}@internal.funly`,
      first_login_post_eligible: false,
    })
    .select('id, username, display_name')
    .single()

  if (insertErr) {
    console.error('[admin/models POST]', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ model: newModel }, { status: 201 })
}
