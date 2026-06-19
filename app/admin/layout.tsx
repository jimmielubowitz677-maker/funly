import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Crown, LayoutDashboard, FileText, Users, DollarSign, MessageSquare, UserCircle2, ChevronLeft } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const navItems = [
  { href: '/admin',             label: 'Dashboard', icon: LayoutDashboard, exact: true  },
  { href: '/admin/posts',       label: 'Posts',     icon: FileText                      },
  { href: '/admin/subscribers', label: 'Subs',      icon: Users                         },
  { href: '/admin/payments',    label: 'Payments',  icon: DollarSign                    },
  { href: '/admin/messages',    label: 'Messages',  icon: MessageSquare                 },
  { href: '/admin/profile',     label: 'Profile',   icon: UserCircle2                   },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const creatorId = process.env.CREATOR_ID?.trim()
  if (!user || !creatorId || user.id !== creatorId) redirect('/feed')

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">

      {/* ── Mobile top nav ── */}
      <div className="md:hidden shrink-0 border-b border-zinc-800/60 bg-zinc-950">
        <div className="flex items-center gap-1 overflow-x-auto px-3 py-3 scrollbar-hidden">
          <div className="flex items-center gap-2 px-2 mr-1 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm whitespace-nowrap">Admin</span>
          </div>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
          <Link
            href="/feed"
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors whitespace-nowrap ml-auto shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Site
          </Link>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-zinc-800/60 p-4 flex-col gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-3 py-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm">Admin Panel</span>
        </div>

        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        <div className="mt-auto pt-4 border-t border-zinc-800">
          <Link
            href="/feed"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Site
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
