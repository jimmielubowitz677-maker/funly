'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function BecomeCreatorButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/account/become-creator', { method: 'POST' })
      const data = await res.json() as { success?: boolean; already?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="primary" size="sm" loading={loading} onClick={handleClick}>
        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Setting up…</> : 'Become a Creator'}
      </Button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
