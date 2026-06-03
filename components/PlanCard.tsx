'use client'

import { Check, Crown, Loader2, Star, Sparkles } from 'lucide-react'
import Button from './ui/Button'
import { cn } from '@/lib/utils'

export interface Plan {
  id: string
  name: string
  price: number
  period: string
  description: string
  features: string[]
  badge?: string
  highlighted?: boolean
  icon: 'star' | 'crown' | 'sparkles'
}

interface PlanCardProps {
  plan: Plan
  isLoading?: boolean
  disabled?: boolean
  onSelect: (id: string) => void
}

const icons = { star: Star, crown: Crown, sparkles: Sparkles }

export default function PlanCard({ plan, isLoading, disabled, onSelect }: PlanCardProps) {
  const Icon = icons[plan.icon]

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 transition-all duration-300',
        plan.highlighted
          ? 'border-pink-500/50 bg-gradient-to-b from-pink-500/10 to-zinc-900 shadow-xl shadow-pink-500/10 scale-[1.02]'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-pink-500 to-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-pink-500/30">
            {plan.badge}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            plan.highlighted ? 'bg-pink-500/20' : 'bg-zinc-800'
          )}
        >
          <Icon className={cn('w-5 h-5', plan.highlighted ? 'text-pink-400' : 'text-zinc-400')} />
        </div>
        <div>
          <h3 className="font-bold text-white">{plan.name}</h3>
          <p className="text-xs text-zinc-500">{plan.description}</p>
        </div>
      </div>

      <div className="mb-5">
        <span className="text-4xl font-black text-white">${plan.price}</span>
        <span className="text-zinc-500 text-sm ml-1">/{plan.period}</span>
      </div>

      <ul className="flex flex-col gap-2.5 mb-6 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-pink-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-zinc-300">{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={plan.highlighted ? 'primary' : 'outline'}
        size="lg"
        className="w-full"
        disabled={disabled}
        onClick={() => onSelect(plan.id)}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting…
          </span>
        ) : (
          'Subscribe Now'
        )}
      </Button>
    </div>
  )
}
