import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import Link from 'next/link'
import { Lollipop, LayoutDashboard, FileText, Users, DollarSign, MessageSquare, UserCircle2, ChevronLeft, UserSquare2, Activity } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import ModelSwitcher from '@/components/admin/ModelSwitcher'

const navItems = [
  { href: '/admin',             label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/posts',       label: 'Posts',     icon: FileText        },
  { href: '/admin/subscribers', label: 'Subs',      icon: Users           },
  { href: '/admin/payments',    label: 'Payments',  icon: DollarSign      },
  { href: '/admin/messages',    label: 'Messages',  icon: MessageSquare   },
  { href: '/admin/profile',     label: 'Profile',   icon: UserCircle2     },
  { href: '/admin/visitors',    label: 'Visitors',  icon: Activity        },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/feed')

  const service     = getSupabaseServiceClient()
  const cookieStore = cookies()
  const pathname    = headers().get('x-pathname') ?? ''
  const isModelsPage = pathname === '/admin/models' || pathname.startsWith('/admin/models/')

  // Auto-migrate: if this user is a legacy creator with no owner_id set, claim it
  const { data: selfCreator } = await service
    .from('users')
    .select('id')
    .eq('id', user.id)
    .eq('is_creator', true)
    .is('owner_id', null)
    .maybeSingle()

  if (selfCreator) {
    await service.from('users').update({ owner_id: user.id }).eq('id', user.id)
  }

  // Fetch all models owned by this user
  const { data: models } = await service
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('owner_id', user.id)
    .eq('is_creator', true)
    .order('created_at', { ascending: true })

  const allModels = models ?? []

  if (allModels.length === 0 && !isModelsPage) {
    redirect('/admin/models')
  }

  const cookieModelId  = cookieStore.get('selected_model_id')?.value
  const selectedModel  = allModels.find(m => m.id === cookieModelId) ?? null

  // Auto-select first model when cookie is stale/missing
  if (allModels.length > 0 && !selectedModel && !isModelsPage) {
    redirect(`/api/admin/switch-model?id=${allModels[0].id}&redirect=${encodeURIComponent(pathname || '/admin')}`)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">

      {/* ── Mobile top nav ── */}
      <div className="md:hidden shrink-0 border-b border-zinc-800/60 bg-zinc-950">
        <div className="flex items-center gap-1 overflow-x-auto px-3 py-3 scrollbar-hidden">
          <div className="flex items-center gap-2 px-2 mr-1 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
              <Lollipop className="w-3.5 h-3.5 text-white" style={{ transform: 'rotate(25deg)' }} />
            </div>
            <span className="font-bold text-sm whitespace-nowrap">Admin</span>
          </div>
          {(selectedModel ? navItems : []).map(({ href, label, icon: Icon }) => (
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
            href="/admin/models"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserSquare2 className="w-3.5 h-3.5" />
            Models
          </Link>
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
      <aside className="hidden md:flex w-56 shrink-0 border-r border-zinc-800/60 p-4 flex-col gap-1 sticky top-0 h-screen overflow-y-auto scrollbar-hidden">
        <div className="flex items-center gap-2 px-3 py-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Lollipop className="w-4 h-4 text-white" style={{ transform: 'rotate(25deg)' }} />
          </div>
          <span className="font-bold text-sm">Admin Panel</span>
        </div>

        <ModelSwitcher models={allModels} selectedModelId={selectedModel?.id ?? null} />

        {selectedModel && (
          <div className="flex flex-col gap-1 mt-1">
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
          </div>
        )}

        <div className={`flex flex-col gap-1 ${selectedModel ? 'mt-3 pt-3 border-t border-zinc-800' : 'mt-1'}`}>
          <Link
            href="/admin/models"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <UserSquare2 className="w-4 h-4" />
            My Models
          </Link>
        </div>

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
