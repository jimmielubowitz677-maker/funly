import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Crown, ChevronRight } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import BecomeCreatorButton from './BecomeCreatorButton'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('username, display_name, email, is_creator')
    .eq('id', user.id)
    .maybeSingle()

  const isCreator = profile?.is_creator ?? false

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-xl sm:text-2xl font-bold mb-8">Account</h1>

      {/* User info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-5">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Profile</p>
        <p className="font-semibold text-white">{profile?.display_name ?? profile?.username ?? '—'}</p>
        <p className="text-sm text-zinc-500 mt-0.5">@{profile?.username}</p>
        <p className="text-sm text-zinc-500 mt-0.5">{profile?.email ?? user.email}</p>
      </div>

      {/* Creator section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Creator</p>

        {isCreator ? (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">You&apos;re a creator</p>
              <p className="text-sm text-zinc-500 mt-0.5">Manage your posts, subscribers, and earnings from the Admin Panel.</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Go to Admin Panel
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-pink-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Become a Creator</p>
              <p className="text-sm text-zinc-500 mt-1 mb-4">
                Start publishing exclusive content, set up subscriptions, and earn from your fans.
              </p>
              <BecomeCreatorButton />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
