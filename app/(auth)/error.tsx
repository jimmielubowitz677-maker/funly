'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-white mb-1">Something went wrong</h2>
      <p className="text-zinc-500 text-sm mb-6">An error occurred. Please try again.</p>
      <div className="flex flex-col gap-2">
        <button
          onClick={reset}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/20 transition-all"
        >
          Try Again
        </button>
        <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  )
}
