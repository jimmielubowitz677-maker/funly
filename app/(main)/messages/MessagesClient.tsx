'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Lock, Crown, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface ConversationPreview {
  creator: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    isVerified: boolean
  }
  lastMessageBody: string | null
  lastMessageAt: string | null
  canMessage: boolean
}

interface ActiveCreator {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  canMessage: boolean
}

interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string | null
  created_at: string
}

interface MessagesClientProps {
  userId: string
  conversations: ConversationPreview[]
  activeCreatorId: string | null
  activeCreator: ActiveCreator | null
  initialMessages: MessageRow[]
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function MessagesClient({
  userId, conversations, activeCreatorId, activeCreator, initialMessages,
}: MessagesClientProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(activeCreatorId ? 'thread' : 'list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages, activeCreatorId])

  useEffect(() => {
    if (activeCreatorId) setMobileView('thread')
  }, [activeCreatorId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeCreatorId) return
    const channel = supabase
      .channel(`messages-${userId}-${activeCreatorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as MessageRow
        const inConv =
          (msg.sender_id === userId && msg.recipient_id === activeCreatorId) ||
          (msg.sender_id === activeCreatorId && msg.recipient_id === userId)
        if (inConv) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, activeCreatorId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text || sending || !activeCreatorId) return
    setSending(true)
    setMessage('')
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, recipient_id: activeCreatorId, body: text })
      .select('id, sender_id, recipient_id, body, created_at')
      .single()
    if (!error && data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as MessageRow])
    }
    setSending(false)
  }

  function openConversation(username: string) {
    router.push(`/messages?with=${username}`)
  }

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CR'

  return (
    <div className="flex h-[calc(100svh-4rem)] md:h-screen">
      {/* ── Conversation list ── */}
      <div className={cn(
        'w-full md:w-72 border-r border-zinc-800 flex flex-col bg-zinc-950',
        mobileView === 'thread' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 md:px-5 py-4 border-b border-zinc-800">
          <h1 className="font-bold text-lg">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 py-8">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">No conversations yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Visit a creator&apos;s page and tap <strong>Message</strong> to start chatting
                </p>
              </div>
              <Link href="/subscriptions" className="text-xs text-pink-400 hover:text-pink-300 transition-colors mt-1">
                Browse creators →
              </Link>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = conv.creator.id === activeCreatorId
              return (
                <button
                  key={conv.creator.id}
                  onClick={() => openConversation(conv.creator.username)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                    isActive
                      ? 'bg-pink-500/10 border border-pink-500/20'
                      : 'hover:bg-zinc-800/70 border border-transparent'
                  )}
                >
                  <Avatar
                    initials={initials(conv.creator.displayName)}
                    src={conv.creator.avatarUrl}
                    verified={conv.creator.isVerified}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-sm truncate">{conv.creator.displayName}</span>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] text-zinc-600 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {conv.lastMessageBody ?? 'Start the conversation'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        {!activeCreator ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-zinc-600" />
            </div>
            <div>
              <p className="font-semibold text-zinc-400">Select a conversation</p>
              <p className="text-sm text-zinc-600 mt-1">Choose from the list or message a creator</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 md:px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <button
                onClick={() => { setMobileView('list'); router.push('/messages') }}
                className="md:hidden p-1 -ml-1 text-zinc-400 active:text-zinc-200 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar
                initials={initials(activeCreator.displayName)}
                src={activeCreator.avatarUrl}
                verified={activeCreator.isVerified}
              />
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/${activeCreator.username}`} className="font-semibold hover:underline">
                    {activeCreator.displayName}
                  </Link>
                  <span className="text-xs bg-pink-500/15 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-md font-semibold">Creator</span>
                </div>
                <p className="text-xs text-zinc-500">@{activeCreator.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-zinc-600 text-sm">No messages yet. Say hello!</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex items-end gap-2', msg.sender_id === userId ? 'justify-end' : 'justify-start')}>
                  {msg.sender_id !== userId && (
                    <Avatar
                      initials={initials(activeCreator.displayName)}
                      src={activeCreator.avatarUrl}
                      size="sm"
                      className="mb-1 shrink-0"
                    />
                  )}
                  <div className={cn(
                    'max-w-[75%] md:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                    msg.sender_id === userId
                      ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                  )}>
                    {msg.body}
                    <span className={cn('block text-[10px] mt-1', msg.sender_id === userId ? 'text-pink-200/60' : 'text-zinc-500')}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {activeCreator.canMessage ? (
              <form
                onSubmit={handleSend}
                className="p-3 md:p-4 pb-[calc(0.75rem+4rem)] md:pb-4 border-t border-zinc-800 bg-zinc-950"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Send a message…"
                    disabled={sending}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || sending}
                    className="w-10 h-10 shrink-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 md:p-4 pb-[calc(0.75rem+4rem)] md:pb-4 border-t border-zinc-800 bg-zinc-950">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Superfan or VIP Required</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Upgrade to message this creator directly</p>
                  </div>
                  <Link href={`/${activeCreator.username}`} className="shrink-0">
                    <Button variant="primary" size="sm">
                      <Crown className="w-3.5 h-3.5" />
                      Upgrade
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
