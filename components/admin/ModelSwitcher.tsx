'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Model {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface ModelSwitcherProps {
  models: Model[]
  selectedModelId: string | null
}

export default function ModelSwitcher({ models, selectedModelId }: ModelSwitcherProps) {
  const selected = models.find(m => m.id === selectedModelId) ?? null
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (models.length === 0) return null

  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden">
          {selected?.avatar_url
            ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
            : initials(selected?.display_name ?? selected?.username ?? '?')
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">
            {selected ? (selected.display_name ?? selected.username) : 'Select model'}
          </p>
          {selected && <p className="text-[10px] text-zinc-500 leading-tight">@{selected.username}</p>}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-xl">
          {models.map(m => (
            <a
              key={m.id}
              href={`/api/admin/switch-model?id=${m.id}&redirect=/admin`}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-700 transition-colors ${m.id === selectedModelId ? 'bg-zinc-700/50' : ''}`}
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  : initials(m.display_name ?? m.username)
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200 truncate">{m.display_name ?? m.username}</p>
                <p className="text-[10px] text-zinc-500">@{m.username}</p>
              </div>
              {m.id === selectedModelId && (
                <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
