import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import NewModelForm from './NewModelForm'

export const dynamic = 'force-dynamic'

export default async function ModelsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()
  const { data: models } = await service
    .from('users')
    .select('id, username, display_name, avatar_url, created_at')
    .eq('owner_id', user.id)
    .eq('is_creator', true)
    .order('created_at', { ascending: true })

  const modelIds = (models ?? []).map(m => m.id)
  let subCounts:  Record<string, number> = {}
  let postCounts: Record<string, number> = {}

  if (modelIds.length) {
    const [{ data: subs }, { data: posts }] = await Promise.all([
      service.from('subscriptions').select('creator_id').in('creator_id', modelIds).eq('status', 'active'),
      service.from('posts').select('creator_id').in('creator_id', modelIds),
    ])
    subCounts  = (subs  ?? []).reduce((a, s) => ({ ...a, [s.creator_id]: (a[s.creator_id] ?? 0) + 1 }), {} as Record<string, number>)
    postCounts = (posts ?? []).reduce((a, p) => ({ ...a, [p.creator_id]: (a[p.creator_id] ?? 0) + 1 }), {} as Record<string, number>)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">My Models</h1>
        <p className="text-zinc-500 text-sm mt-1">Creator profiles managed by your account</p>
      </div>

      {models?.length ? (
        <div className="grid gap-3 mb-8">
          {models.map(model => {
            const initials = (model.display_name ?? model.username).slice(0, 2).toUpperCase()
            return (
              <div key={model.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {model.avatar_url
                    ? <img src={model.avatar_url} alt="" className="w-full h-full object-cover" />
                    : initials
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-100 truncate">{model.display_name ?? model.username}</p>
                  <p className="text-xs text-zinc-500">@{model.username}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {subCounts[model.id] ?? 0} subscribers · {postCounts[model.id] ?? 0} posts
                  </p>
                </div>
                <a
                  href={`/api/admin/switch-model?id=${model.id}&redirect=/admin`}
                  className="flex-shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                >
                  Manage →
                </a>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-14 text-center mb-8">
          <p className="text-zinc-400 font-medium">No creator profiles yet</p>
          <p className="text-zinc-600 text-sm mt-1">Create your first model below to get started.</p>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
        <h2 className="font-bold text-sm mb-5">Create New Model</h2>
        <NewModelForm />
      </div>
    </div>
  )
}
