'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxItem {
  url: string
  type: 'image' | 'video'
}

interface MediaLightboxProps {
  items: LightboxItem[]
  initialIndex?: number
  onClose: () => void
}

export default function MediaLightbox({ items, initialIndex = 0, onClose }: MediaLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const item = items[index]
  const touchStartX = useRef<number | null>(null)

  const prev = () => setIndex(i => (i - 1 + items.length) % items.length)
  const next = () => setIndex(i => (i + 1) % items.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft'  && items.length > 1) prev()
      if (e.key === 'ArrowRight' && items.length > 1) next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, onClose])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50 && items.length > 1) { if (diff > 0) next(); else prev() }
    touchStartX.current = null
  }

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-700 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-zinc-800/70 backdrop-blur-sm text-xs text-zinc-300 font-medium pointer-events-none">
          {index + 1} / {items.length}
        </div>
      )}

      {/* Prev */}
      {items.length > 1 && (
        <button
          aria-label="Previous"
          onClick={e => { e.stopPropagation(); prev() }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Next */}
      {items.length > 1 && (
        <button
          aria-label="Next"
          onClick={e => { e.stopPropagation(); next() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-700 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Media */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {item.type === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
            style={{ maxWidth: 'min(90vw, 960px)' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.url}
            src={item.url}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            style={{ maxWidth: 'min(90vw, 960px)' }}
          />
        )}
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
          {items.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-zinc-600'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
