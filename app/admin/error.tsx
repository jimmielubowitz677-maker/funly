'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Admin error</h2>
        <p className="text-zinc-500 text-sm mb-1">Something went wrong loading this page.</p>
        {error.digest && <p className="text-zinc-700 text-xs mb-4 font-mono">ID: {error.digest}</p>}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link href="/admin" className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
