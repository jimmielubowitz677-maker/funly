import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServerClient, getSupabaseServiceClient } from './supabase/server'

type AdminResult =
  | { userId: string; modelId: string; error: null }
  | { userId: null;   modelId: null;   error: NextResponse }

export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { userId: null, modelId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const cookieStore     = cookies()
  const selectedModelId = cookieStore.get('selected_model_id')?.value

  if (!selectedModelId) {
    return { userId: null, modelId: null, error: NextResponse.json({ error: 'No model selected' }, { status: 403 }) }
  }

  const service = getSupabaseServiceClient()
  const { data: model } = await service
    .from('users')
    .select('id')
    .eq('id', selectedModelId)
    .eq('owner_id', user.id)
    .eq('is_creator', true)
    .maybeSingle()

  if (!model) {
    return { userId: null, modelId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { userId: user.id, modelId: selectedModelId, error: null }
}

export async function getSelectedModel(ownerUserId: string): Promise<{
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
} | null> {
  const cookieStore     = cookies()
  const selectedModelId = cookieStore.get('selected_model_id')?.value
  if (!selectedModelId) return null

  const service = getSupabaseServiceClient()
  const { data } = await service
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('id', selectedModelId)
    .eq('owner_id', ownerUserId)
    .eq('is_creator', true)
    .maybeSingle()

  return data ?? null
}
