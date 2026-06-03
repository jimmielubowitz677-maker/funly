import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import MessagesClient from './MessagesClient'

export default async function MessagesPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const creatorId = process.env.CREATOR_ID?.trim() ?? ''
  const service = getSupabaseServiceClient()

  const [
    { data: creatorRow },
    { data: rawMessages },
    { data: subscription },
  ] = await Promise.all([
    service
      .from('users')
      .select('username, display_name, is_verified')
      .eq('id', creatorId)
      .maybeSingle(),
    service
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${creatorId}),and(sender_id.eq.${creatorId},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100),
    service
      .from('subscriptions')
      .select('plan_id')
      .eq('subscriber_id', user.id)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .in('plan_id', ['superfan', 'vip'])
      .maybeSingle(),
  ])

  const canMessage = !!subscription

  const creatorDisplayName = creatorRow?.display_name ?? creatorRow?.username ?? 'Creator'
  const creatorUsername = creatorRow?.username ?? 'creator'
  const creatorInitials = creatorDisplayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CR'

  return (
    <MessagesClient
      initialMessages={(rawMessages ?? []) as Array<{
        id: string
        sender_id: string
        recipient_id: string
        body: string | null
        created_at: string
      }>}
      creator={{
        displayName: creatorDisplayName,
        username: creatorUsername,
        initials: creatorInitials,
        isVerified: creatorRow?.is_verified ?? false,
      }}
      userId={user.id}
      creatorId={creatorId}
      canMessage={canMessage}
    />
  )
}
