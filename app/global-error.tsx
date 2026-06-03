'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-black text-white mb-2">Something went wrong</h1>
          <p className="text-zinc-500 text-sm mb-6">An unexpected error occurred. Please try again.</p>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
