import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { code, user_id } = await req.json()
    if (!code?.trim()) {
      return NextResponse.json({ error: 'Código de invitación requerido' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const targetUserId = user_id ?? user?.id
    if (!targetUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar familia por invite_code
    const { data: family } = await supabase
      .from('families')
      .select('id, name')
      .eq('invite_code', code.trim().toLowerCase())
      .single()

    if (!family) {
      return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 404 })
    }

    // Unir al usuario a la familia
    const { error } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'member' })
      .eq('id', targetUserId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      family_id: family.id,
      family_name: family.name,
      redirect: '/preferencias',
    })
  } catch (err) {
    console.error('[api/familia/unirse]', err)
    return NextResponse.json({ error: 'Error al unirse a la familia' }, { status: 500 })
  }
}
