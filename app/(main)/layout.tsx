import Sidebar from '@/components/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      {/* pb-16 reserves space above the mobile bottom nav (≈64px) */}
      <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
    </div>
  )
}
