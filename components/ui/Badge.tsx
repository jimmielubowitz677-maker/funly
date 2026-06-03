import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'free' | 'premium' | 'ppv' | 'vip' | 'draft' | 'published'
  | 'active' | 'cancelled' | 'expired' | 'past_due'
  | 'completed' | 'failed' | 'refunded' | 'pending'
  | 'fan' | 'superfan'
  | 'crypto' | 'stripe' | 'paypal'

interface BadgeProps {
  variant: BadgeVariant
  className?: string
}

const styles: Record<BadgeVariant, string> = {
  free:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  premium:   'bg-pink-500/15 text-pink-400 border-pink-500/30',
  ppv:       'bg-amber-500/15 text-amber-400 border-amber-500/30',
  vip:       'bg-purple-500/15 text-purple-400 border-purple-500/30',
  draft:     'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  published: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  expired:   'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  past_due:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  refunded:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  fan:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  superfan:  'bg-pink-500/15 text-pink-400 border-pink-500/30',
  crypto:    'bg-orange-500/15 text-orange-400 border-orange-500/30',
  stripe:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  paypal:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

const labels: Record<BadgeVariant, string> = {
  free: 'Free', premium: 'Premium', ppv: 'PPV', vip: 'VIP',
  draft: 'Draft', published: 'Published',
  active: 'Active', cancelled: 'Cancelled', expired: 'Expired', past_due: 'Past Due',
  completed: 'Completed', failed: 'Failed', refunded: 'Refunded', pending: 'Pending',
  fan: 'Fan', superfan: 'Superfan',
  crypto: 'Crypto', stripe: 'Stripe', paypal: 'PayPal',
}

export default function Badge({ variant, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap',
        styles[variant],
        className
      )}
    >
      {labels[variant]}
    </span>
  )
}
