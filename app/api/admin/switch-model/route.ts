import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const modelId      = request.nextUrl.searchParams.get('id')
  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/admin'

  if (!modelId) return NextResponse.redirect(new URL('/admin/models', request.url))

  const service = getSupabaseServiceClient()
  const { data: model } = await service
    .from('users')
    .select('id')
    .eq('id', modelId)
    .eq('owner_id', user.id)
    .eq('is_creator', true)
    .maybeSingle()

  if (!model) return NextResponse.redirect(new URL('/admin/models', request.url))

  const safeRedirect = redirectPath.startsWith('/') ? redirectPath : '/admin'
  const url = new URL(safeRedirect, request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set('selected_model_id', modelId, {
    path:     '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
  })
  return response
}
