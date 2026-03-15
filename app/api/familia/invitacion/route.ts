import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const family_id = req.nextUrl.searchParams.get('family_id')
    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: family } = await supabase
      .from('families')
      .select('id, name, invite_code')
      .eq('id', family_id)
      .single()

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const baseUrl = req.nextUrl.origin
    const invite_link = `${baseUrl}/unirse?codigo=${family.invite_code}`

    return NextResponse.json({
      family_id: family.id,
      family_name: family.name,
      invite_code: family.invite_code,
      invite_link,
    })
  } catch (err) {
    console.error('[api/familia/invitacion]', err)
    return NextResponse.json({ error: 'Error al obtener la invitación' }, { status: 500 })
  }
}
