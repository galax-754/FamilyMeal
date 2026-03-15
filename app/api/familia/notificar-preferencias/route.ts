import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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

    // Verificar que el usuario es admin de esta familia
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, family_id')
      .eq('id', user.id)
      .single()

    if (profile?.family_id !== family_id || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede enviar notificaciones' }, { status: 403 })
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_id', family_id)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No hay miembros en la familia' }, { status: 400 })
    }

    for (const member of members) {
      await supabase
        .from('user_preferences')
        .upsert({
          profile_id: member.id,
          family_id,
          week_number: weekNumber,
          year,
          notified_at: new Date().toISOString(),
          preferences_completed: false,
        }, { onConflict: 'profile_id,week_number,year' })
    }

    return NextResponse.json({ success: true, notified: members.length })
  } catch (err) {
    console.error('[notificar-preferencias]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
