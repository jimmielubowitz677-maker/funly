import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function MessagesPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const creatorId = user.id
  const service   = getSupabaseServiceClient()

  const { data: msgs } = await service
    .from('messages')
    .select('id,sender_id,recipient_id,body,status,created_at')
    .or(`sender_id.eq.${creatorId},recipient_id.eq.${creatorId}`)
    .order('created_at', { ascending: false })

  // Group into conversations keyed by the other participant's ID
  const convMap = new Map<string, { otherId: string; lastMsg: typeof msgs extends null ? never : NonNullable<typeof msgs>[0]; count: number; unread: number }>()

  for (const msg of msgs ?? []) {
    const otherId = msg.sender_id === creatorId ? msg.recipient_id : msg.sender_id
    if (!convMap.has(otherId)) {
      convMap.set(otherId, { otherId, lastMsg: msg, count: 1, unread: 0 })
    } else {
      convMap.get(otherId)!.count++
    }
    // Count unread messages FROM the subscriber (not yet read by creator)
    if (msg.sender_id !== creatorId && msg.status !== 'read') {
      convMap.get(otherId)!.unread++
    }
  }

  const conversations = Array.from(convMap.values())

  // Fetch user info for conversation partners
  const otherIds = conversations.map(c => c.otherId)
  let userMap: Record<string, { username: string; email: string }> = {}

  if (otherIds.length) {
    const { data: users } = await service.from('users').select('id,username,email').in('id', otherIds)
    userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Messages</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
      </div>

      {conversations.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/60">
          {conversations.map(({ otherId, lastMsg, count, unread }) => {
            const u = userMap[otherId]
            const initials = (u?.username ?? '?').slice(0, 2).toUpperCase()
            const fromCreator = lastMsg.sender_id === creatorId

            return (
              <div key={otherId} className="flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{u?.username ?? otherId.slice(0, 8)}</p>
                    <span className="text-xs text-zinc-600 shrink-0">{timeAgo(lastMsg.created_at)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {fromCreator && <span className="text-zinc-600">You: </span>}
                    {lastMsg.body ?? '(no text)'}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{u?.email} · {count} message{count !== 1 ? 's' : ''}</p>
                </div>

                {unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-white">{unread}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-16 text-center">
          <p className="text-zinc-600 text-sm">No messages yet.</p>
        </div>
      )}
    </div>
  )
}
