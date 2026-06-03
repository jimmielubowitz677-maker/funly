'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Lock, Crown } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string | null
  created_at: string
}

interface CreatorInfo {
  displayName: string
  username: string
  initials: string
  isVerified: boolean
}

interface MessagesClientProps {
  initialMessages: MessageRow[]
  creator: CreatorInfo
  userId: string
  creatorId: string
  canMessage: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessagesClient({
  initialMessages,
  creator,
  userId,
  creatorId,
  canMessage,
}: MessagesClientProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${userId}-${creatorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as MessageRow
          const inConversation =
            (msg.sender_id === userId && msg.recipient_id === creatorId) ||
            (msg.sender_id === creatorId && msg.recipient_id === userId)
          if (inConversation) {
            setMessages(prev => {
              // Deduplicate in case the optimistic insert and the realtime event overlap
              if (prev.some(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, creatorId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text || sending) return

    setSending(true)
    setMessage('')

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, recipient_id: creatorId, body: text })
      .select('id, sender_id, recipient_id, body, created_at')
      .single()

    if (!error && data) {
      // Optimistically add the message; deduplication in the realtime handler prevents doubling
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev
        return [...prev, data as MessageRow]
      })
    }

    setSending(false)
  }

  const lastMsg = messages[messages.length - 1]

  return (
    <div className="flex h-[calc(100svh-4rem)] md:h-screen">
      {/* ── Conversation list ── */}
      <div
        className={cn(
          'w-full md:w-72 border-r border-zinc-800 flex flex-col bg-zinc-950',
          mobileView === 'thread' ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="px-4 md:px-5 py-4 border-b border-zinc-800">
          <h1 className="font-bold text-lg">Messages</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {canMessage ? 'Direct messaging unlocked' : 'Superfan or VIP required'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setMobileView('thread')}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-left"
          >
            <Avatar initials={creator.initials} verified={creator.isVerified} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{creator.displayName}</span>
                {lastMsg && (
                  <span className="text-xs text-zinc-600 flex-shrink-0">{formatTime(lastMsg.created_at)}</span>
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate">
                {lastMsg?.body ?? 'Start the conversation'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Thread ── */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        )}
      >
        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 md:px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <button
            onClick={() => setMobileView('list')}
            className="md:hidden p-1 -ml-1 text-zinc-400 active:text-zinc-200 transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar initials={creator.initials} verified={creator.isVerified} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{creator.displayName}</span>
              <span className="text-xs bg-pink-500/15 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-md font-semibold">
                Creator
              </span>
            </div>
            <p className="text-xs text-emerald-400 font-medium">Online now</p>
          </div>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-zinc-600 text-sm">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn('flex items-end gap-2', msg.sender_id === userId ? 'justify-end' : 'justify-start')}
            >
              {msg.sender_id !== userId && (
                <Avatar initials={creator.initials} size="sm" className="mb-1 flex-shrink-0" />
              )}
              <div
                className={cn(
                  'max-w-[75%] md:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                  msg.sender_id === userId
                    ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-sm'
                    : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                )}
              >
                {msg.body}
                <span
                  className={cn(
                    'block text-[10px] mt-1',
                    msg.sender_id === userId ? 'text-pink-200/60' : 'text-zinc-500'
                  )}
                >
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {canMessage ? (
          <form
            onSubmit={handleSend}
            className="p-3 md:p-4 pb-[calc(0.75rem+4rem)] md:pb-4 border-t border-zinc-800 bg-zinc-950"
          >
            <div className="flex items-center gap-2">
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Send a message..."
                disabled={sending}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 md:p-4 pb-[calc(0.75rem+4rem)] md:pb-4 border-t border-zinc-800 bg-zinc-950">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Superfan or VIP Membership Required</p>
                <p className="text-xs text-zinc-500 mt-0.5">Upgrade to message the creator directly</p>
              </div>
              <Link href="/subscriptions" className="flex-shrink-0">
                <Button variant="primary" size="sm">
                  <Crown className="w-3.5 h-3.5" />
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
