import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getWeekNumber } from '@/lib/votes'

export async function POST(req: NextRequest) {
  try {
    const { family_id } = await req.json()
    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario es admin de esta familia
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, family_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.family_id !== family_id || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el admin puede enviar notificaciones' }, { status: 403 })
    }

    const semana = getWeekNumber(new Date())
    const anio = new Date().getFullYear()

    // Registrar en weekly_voting_status que se solicitó llenar preferencias
    await supabase
      .from('weekly_voting_status')
      .upsert(
        {
          family_id,
          week_number: semana,
          year: anio,
          voting_started: false,
        },
        { onConflict: 'family_id,week_number,year' }
      )

    // Obtener miembros para saber a quiénes notificar
    const { data: members } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('family_id', family_id)
      .neq('id', user.id)

    return NextResponse.json({
      success: true,
      notified_count: (members ?? []).length,
      message: `Notificación enviada a ${(members ?? []).length} miembro(s)`,
    })
  } catch (err) {
    console.error('[api/familia/notificar-preferencias]', err)
    return NextResponse.json({ error: 'Error al enviar la notificación' }, { status: 500 })
  }
}
