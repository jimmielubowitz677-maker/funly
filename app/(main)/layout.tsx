import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let isCreator = false
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const service = getSupabaseServiceClient()
      const { data } = await service
        .from('users')
        .select('is_creator')
        .eq('id', user.id)
        .maybeSingle()
      isCreator = data?.is_creator ?? false
    }
  } catch {
    // silently ignore — sidebar just won't show admin link
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar isCreator={isCreator} />
      {/* pb-16 reserves space above the mobile bottom nav (≈64px) */}
      <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
    </div>
  )
}
