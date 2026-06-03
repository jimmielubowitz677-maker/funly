'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, MessageCircle, Star, Crown, LogOut, Shield } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/feed',          label: 'Feed',      icon: Home          },
  { href: '/messages',      label: 'Messages',  icon: MessageCircle },
  { href: '/subscriptions', label: 'Subscribe', icon: Star          },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = getSupabaseBrowserClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkClass = (href: string) => cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
    pathname === href || (href !== '/feed' && pathname.startsWith(href))
      ? 'bg-pink-500/15 text-pink-400 border border-pink-500/20'
      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
  )

  const adminLinkClass = cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
    pathname.startsWith('/admin')
      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 flex-shrink-0 h-screen sticky top-0 flex-col border-r border-zinc-800/60 bg-zinc-950 p-4">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">CreatorHub</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}

          <div className="my-3 border-t border-zinc-800" />

          <Link href="/admin" className={adminLinkClass}>
            <Shield className="w-4 h-4" />
            Admin Panel
          </Link>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/60">
        <div className="flex items-center justify-around px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/feed' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200',
                  active ? 'text-pink-400' : 'text-zinc-500 active:text-zinc-300'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          <Link
            href="/admin"
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200',
              pathname.startsWith('/admin') ? 'text-purple-400' : 'text-zinc-500 active:text-zinc-300'
            )}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-zinc-500 active:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </>
  )
}
