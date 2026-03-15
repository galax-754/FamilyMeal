'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Intercepta cualquier página de la app y redirige automáticamente
 * a /preferencias solo si el usuario tiene una notificación pendiente
 * Y no tiene ningún registro con preferences_completed = true.
 */
export function NotificacionGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/preferencias') return

    async function checkPendingNotification() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Si ya completó en algún momento, no redirigir nunca
      const { data: completado } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('profile_id', user.id)
        .eq('preferences_completed', true)
        .maybeSingle()

      if (completado) return

      // Solo redirigir si tiene notificación pendiente
      const { data: notificado } = await supabase
        .from('user_preferences')
        .select('notified_at')
        .eq('profile_id', user.id)
        .not('notified_at', 'is', null)
        .maybeSingle()

      if (notificado) {
        router.push('/preferencias')
      }
    }

    checkPendingNotification()
  }, [pathname, router])

  return null
}
