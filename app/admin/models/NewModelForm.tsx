'use client'

import { useState } from 'react'

export default function NewModelForm() {
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res  = await fetch('/api/admin/models', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, display_name: displayName }),
    })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(json.error ?? 'Failed to create model')
      setLoading(false)
      return
    }

    // Switch to the new model and go to the admin dashboard
    window.location.href = `/api/admin/switch-model?id=${json.model.id}&redirect=/admin`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username *</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="e.g. jessica_model"
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
          />
          <p className="text-[11px] text-zinc-600 mt-1">Letters, numbers, underscores · 3–30 chars</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Jessica"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all"
      >
        {loading ? 'Creating…' : 'Create Model'}
      </button>
    </form>
  )
}
