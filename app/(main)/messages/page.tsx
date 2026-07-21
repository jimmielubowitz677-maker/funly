import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import MessagesClient from './MessagesClient'

export const dynamic = 'force-dynamic'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { with?: string }
}) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()

  // Find all distinct creators this user has messaged (or been messaged by)
  const { data: sentRows } = await service
    .from('messages')
    .select('recipient_id')
    .eq('sender_id', user.id)

  const { data: receivedRows } = await service
    .from('messages')
    .select('sender_id')
    .eq('recipient_id', user.id)

  const partnerIds = Array.from(
    new Set([
      ...(sentRows ?? []).map(r => r.recipient_id as string),
      ...(receivedRows ?? []).map(r => r.sender_id as string),
    ])
  ).filter(id => id !== user.id)

  // Fetch creator info for all conversation partners
  type CreatorRow = { id: string; username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean; is_creator: boolean; is_online: boolean | null }
  const { data: partners } = partnerIds.length
    ? await service.from('users').select('id, username, display_name, avatar_url, is_verified, is_creator, is_online').in('id', partnerIds)
    : { data: [] as CreatorRow[] }

  // Resolve which creator to open from ?with=username
  let activeCreatorId: string | null = null
  if (searchParams.with) {
    const { data: target } = await service
      .from('users')
      .select('id')
      .eq('username', searchParams.with)
      .maybeSingle()
    if (target) activeCreatorId = target.id
  }

  // If ?with= points to someone not yet in conversation list, add them
  if (activeCreatorId && !partnerIds.includes(activeCreatorId)) {
    const { data: extra } = await service
      .from('users')
      .select('id, username, display_name, avatar_url, is_verified, is_creator, is_online')
      .eq('id', activeCreatorId)
      .maybeSingle()
    if (extra) (partners as CreatorRow[]).push(extra as CreatorRow)
  }

  // For each partner, fetch their latest message and check canMessage
  const conversationData = await Promise.all(
    (partners as CreatorRow[]).map(async p => {
      const [{ data: lastMsg }, { data: sub }] = await Promise.all([
        service
          .from('messages')
          .select('body, created_at')
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${p.id}),and(sender_id.eq.${p.id},recipient_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        service
          .from('subscriptions')
          .select('plan_id')
          .eq('subscriber_id', user.id)
          .eq('creator_id', p.id)
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString())
          .in('plan_id', ['superfan', 'vip'])
          .maybeSingle(),
      ])
      return { creator: p, lastMsg, canMessage: !!sub }
    })
  )

  // Fetch messages for active conversation
  let initialMessages: Array<{ id: string; sender_id: string; recipient_id: string; body: string | null; created_at: string }> = []
  if (activeCreatorId) {
    const { data: msgs } = await service
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${activeCreatorId}),and(sender_id.eq.${activeCreatorId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100)
    initialMessages = (msgs ?? []) as typeof initialMessages
  }

  const activeConversation = conversationData.find(c => c.creator.id === activeCreatorId) ?? null

  return (
    <MessagesClient
      userId={user.id}
      conversations={conversationData.map(c => ({
        creator: {
          id: c.creator.id,
          username: c.creator.username,
          displayName: c.creator.display_name ?? c.creator.username,
          avatarUrl: c.creator.avatar_url ?? null,
          isVerified: c.creator.is_verified,
          isOnline: c.creator.is_online,
        },
        lastMessageBody: c.lastMsg?.body ?? null,
        lastMessageAt:   c.lastMsg?.created_at ?? null,
        canMessage:      c.canMessage,
      }))}
      activeCreatorId={activeCreatorId}
      activeCreator={activeConversation ? {
        id:          activeConversation.creator.id,
        username:    activeConversation.creator.username,
        displayName: activeConversation.creator.display_name ?? activeConversation.creator.username,
        avatarUrl:   activeConversation.creator.avatar_url ?? null,
        isVerified:  activeConversation.creator.is_verified,
        isOnline: activeConversation.creator.is_online,
        canMessage:  activeConversation.canMessage,
      } : null}
      initialMessages={initialMessages}
    />
  )
}
