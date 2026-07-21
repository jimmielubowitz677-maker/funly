import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (typeof body?.is_online !== 'boolean') return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const service = getSupabaseServiceClient()
  const { data: model } = await service.from('users').select('id').eq('id', params.id).eq('owner_id', user.id).eq('is_creator', true).maybeSingle()
  if (!model) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await service.from('users').update({ is_online: body.is_online, online_status_updated_at: new Date().toISOString() }).eq('id', params.id).select('id,is_online,online_status_updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ model: data })
}
