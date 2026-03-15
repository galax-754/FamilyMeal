'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Intercepta cualquier página de la app y redirige automáticamente
 * a /preferencias si el usuario tiene una notificación pendiente
 * del admin y aún no ha completado sus preferencias.
 */
export function NotificacionGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Evitar loop infinito si ya estamos en /preferencias
    if (pathname === '/preferencias') return

    async function checkPendingNotification() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: pendingNotif } = await supabase
        .from('user_preferences')
        .select('notified_at, preferences_completed')
        .eq('profile_id', user.id)
        .eq('preferences_completed', false)
        .not('notified_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingNotif) {
        router.push('/preferencias')
      }
    }

    checkPendingNotification()
  }, [pathname, router])

  return null
}
