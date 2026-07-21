import { cn } from '@/lib/utils'

export default function OnlineStatus({ online, showOffline = false, className }: { online: boolean; showOffline?: boolean; className?: string }) {
  if (!online && !showOffline) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', online ? 'text-emerald-400' : 'text-zinc-500', className)}>
      <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]' : 'bg-zinc-600')} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
