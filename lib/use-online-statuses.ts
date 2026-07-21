'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export function useOnlineStatuses(initial: Record<string, boolean>) {
  const [statuses, setStatuses] = useState(initial)
  const ids = useMemo(() => Object.keys(initial).sort(), [initial])
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!idsKey) return
    const supabase = getSupabaseBrowserClient()
    const wanted = new Set(ids)
    const channel = supabase.channel(`creator-online:${idsKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
        const row = payload.new as { id?: string; is_online?: boolean }
        if (row.id && wanted.has(row.id) && typeof row.is_online === 'boolean') {
          setStatuses(current => ({ ...current, [row.id!]: row.is_online! }))
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { statuses, setStatuses }
}
