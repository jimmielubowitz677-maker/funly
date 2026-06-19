import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import ProfileForm from './ProfileForm'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const creatorId = user.id
  const service   = getSupabaseServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('username, display_name, bio, avatar_url, banner_url')
    .eq('id', creatorId)
    .maybeSingle()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Profile Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Update the creator profile visible to your subscribers
        </p>
      </div>

      <ProfileForm
        userId={creatorId}
        initialProfile={{
          username:    profile?.username    ?? '',
          displayName: profile?.display_name ?? '',
          bio:         profile?.bio          ?? '',
          avatarUrl:   profile?.avatar_url   ?? null,
          bannerUrl:   profile?.banner_url   ?? null,
        }}
      />
    </div>
  )
}
