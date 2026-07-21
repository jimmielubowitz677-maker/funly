import { cn } from '@/lib/utils'

export default function OnlineStatus({ online, showOffline = true, compact = false, className }: { online: boolean | null | undefined; showOffline?: boolean; compact?: boolean; className?: string }) {
  if (!online && !showOffline) return null
  const isOnline = online === true
  return (
    <span aria-label={isOnline ? 'Online' : 'Offline'} className={cn('inline-flex items-center gap-1.5 text-xs', isOnline ? 'text-emerald-400' : 'text-zinc-500', className)}>
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full shrink-0', isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]' : 'bg-zinc-600')} />
      {!compact && (isOnline ? 'Online' : 'Offline')}
    </span>
  )
}
