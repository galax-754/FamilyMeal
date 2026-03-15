import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificacionGuard } from '@/components/guards/NotificacionGuard'
import { WeekResetGuard } from '@/components/guards/WeekResetGuard'
import { ProfileProvider } from '@/contexts/ProfileContext'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="app-layout">
      <ProfileProvider>
        <NotificacionGuard />
        <WeekResetGuard />
        <main className="app-main">
          {children}
        </main>
        <BottomNav />
      </ProfileProvider>
    </div>
  )
}
