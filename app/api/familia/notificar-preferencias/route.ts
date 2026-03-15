export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getWeekNumber(date: Date): number {
  // El domingo ya es semana nueva: Dom–Sáb en vez de Lun–Dom (ISO)
  const d = new Date(date)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  const dUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = dUTC.getUTCDay() || 7
  dUTC.setUTCDate(dUTC.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1))
  return Math.ceil((((dUTC.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { family_id } = await req.json()
    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, family_id')
      .eq('id', user.id)
      .single()

    if (profile?.family_id !== family_id || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo el administrador puede enviar notificaciones' },
        { status: 403 }
      )
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const now = new Date().toISOString()

    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_id', family_id)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No hay miembros en la familia' }, { status: 400 })
    }

    let notifiedCount = 0

    for (const member of members) {
      // Saltar a miembros que ya tienen preferencias completadas
      const { data: yaCompleto } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('profile_id', member.id)
        .eq('preferences_completed', true)
        .maybeSingle()

      if (yaCompleto) continue

      // Obtener el registro pendiente más reciente (si existe)
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('profile_id', member.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        // Refrescar notified_at para asegurar redirección
        await supabase
          .from('user_preferences')
          .update({ notified_at: now, week_number: weekNumber, year })
          .eq('id', existing.id)
      } else {
        // Sin registro previo — crear uno nuevo
        await supabase
          .from('user_preferences')
          .insert({
            profile_id: member.id,
            family_id,
            week_number: weekNumber,
            year,
            notified_at: now,
            preferences_completed: false,
          })
      }

      notifiedCount++
    }

    return NextResponse.json({ success: true, notified: notifiedCount })
  } catch (err) {
    console.error('[notificar-preferencias]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
