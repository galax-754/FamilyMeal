import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre de la familia es requerido' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Crear familia
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (familyError) throw familyError

    // Asignar al usuario como admin
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'admin' })
      .eq('id', user.id)

    if (profileError) throw profileError

    const baseUrl = req.nextUrl.origin
    const inviteLink = `${baseUrl}/unirse?codigo=${family.invite_code}`

    return NextResponse.json({
      family,
      invite_link: inviteLink,
    })
  } catch (err) {
    console.error('[api/familia/crear]', err)
    return NextResponse.json({ error: 'Error al crear la familia' }, { status: 500 })
  }
}
