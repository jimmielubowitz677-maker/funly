import { cn } from '@/lib/utils'

interface AvatarProps {
  initials: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  verified?: boolean
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function Avatar({ initials, src, size = 'md', className, verified }: AvatarProps) {
  return (
    <div className="relative inline-flex flex-shrink-0">
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-white overflow-hidden',
          sizes[size],
          className
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={initials} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-zinc-950">
          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </div>
  )
}
