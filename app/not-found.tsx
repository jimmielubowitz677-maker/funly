import Link from 'next/link'
import LollipopIcon from '@/components/ui/LollipopIcon'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pink-500/30">
          <LollipopIcon className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-6xl font-black text-white mb-2">404</h1>
        <p className="text-zinc-400 text-lg mb-1">Page not found</p>
        <p className="text-zinc-600 text-sm mb-8">This page doesn&apos;t exist or has been moved.</p>
        <Link
          href="/feed"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  )
}
