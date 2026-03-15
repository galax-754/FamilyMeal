'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Verifica al montar si es una nueva semana y dispara el reinicio automático.
 * Si la semana ya fue iniciada, el endpoint no hace nada.
 */
export function WeekResetGuard() {
  useEffect(() => {
    async function checkWeekReset() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!profile?.family_id) return

      await fetch('/api/reinicio-semanal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: profile.family_id }),
      })
    }

    checkWeekReset()
  }, [])

  return null
}
