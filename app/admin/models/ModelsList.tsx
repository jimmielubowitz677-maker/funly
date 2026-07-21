'use client'

import { useState } from 'react'
import OnlineStatus from '@/components/OnlineStatus'

export interface AdminModel { id: string; username: string; display_name: string | null; avatar_url: string | null; is_online: boolean; subscribers: number; posts: number }

export default function ModelsList({ initialModels }: { initialModels: AdminModel[] }) {
  const [models, setModels] = useState(initialModels)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(model: AdminModel) {
    setBusy(model.id); setError(null)
    try {
      const res = await fetch(`/api/admin/models/${model.id}/online`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_online: !model.is_online }) })
      const data = await res.json() as { model?: { is_online: boolean }; error?: string }
      if (!res.ok || !data.model) throw new Error(data.error ?? 'Could not update status')
      setModels(current => current.map(item => item.id === model.id ? { ...item, is_online: data.model!.is_online } : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update status') }
    finally { setBusy(null) }
  }

  return <div className="grid gap-3 mb-8">
    {error && <p className="text-sm text-red-400">{error}</p>}
    {models.map(model => <div key={model.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-sm font-bold overflow-hidden">{model.avatar_url ? <img src={model.avatar_url} alt="" className="w-full h-full object-cover" /> : (model.display_name ?? model.username).slice(0, 2).toUpperCase()}</div>
      <div className="flex-1 min-w-0"><p className="font-semibold truncate">{model.display_name ?? model.username}</p><p className="text-xs text-zinc-500">@{model.username}</p><p className="text-[11px] text-zinc-600">{model.subscribers} subscribers · {model.posts} posts</p></div>
      <OnlineStatus online={model.is_online} showOffline />
      <button disabled={busy === model.id} onClick={() => toggle(model)} className="px-3 py-1.5 text-xs rounded-xl bg-zinc-800 disabled:opacity-50">{busy === model.id ? 'Saving…' : `Set ${model.is_online ? 'Offline' : 'Online'}`}</button>
      <a href={`/api/admin/switch-model?id=${model.id}&redirect=/admin`} className="px-3 py-1.5 text-xs rounded-xl bg-zinc-800">Manage →</a>
    </div>)}
  </div>
}
