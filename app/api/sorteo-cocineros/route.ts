export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLunesDeSemana } from '@/lib/utils'

const DAYS = [
  { num: 1, name: 'Lunes' },
  { num: 2, name: 'Martes' },
  { num: 3, name: 'Miércoles' },
  { num: 4, name: 'Jueves' },
  { num: 5, name: 'Viernes' },
  { num: 6, name: 'Sábado' },
  { num: 7, name: 'Domingo' },
]

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

// POST — generar sorteo (confirm=false → preview, confirm=true → guardar)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { family_id, confirm = false } = await req.json()

  const weekNumber = getWeekNumber(new Date())
  const year = new Date().getFullYear()

  const { data: members } = await supabase
    .from('profiles')
    .select('id, name, avatar_color')
    .eq('family_id', family_id)

  if (!members || members.length === 0) {
    return NextResponse.json(
      { error: 'No hay miembros en la familia' },
      { status: 400 }
    )
  }

  // Distribución balanceada: rotar cíclicamente entre miembros aleatorios
  const shuffledMembers = [...members].sort(() => Math.random() - 0.5)
  const assignments: Record<number, (typeof members)[0]> = {}

  DAYS.forEach((day, index) => {
    assignments[day.num] = shuffledMembers[index % shuffledMembers.length]
  })

  if (!confirm) {
    const preview = DAYS.map((day) => ({
      day_num: day.num,
      day_name: day.name,
      cook_id: assignments[day.num].id,
      cook_name: assignments[day.num].name,
      cook_color: assignments[day.num].avatar_color,
    }))
    return NextResponse.json({ preview })
  }

  // Borrar asignaciones previas de esta semana
  await supabase
    .from('cooking_assignments')
    .delete()
    .eq('family_id', family_id)
    .eq('week_number', weekNumber)
    .eq('year', year)

  const inserts = DAYS.map((day) => ({
    family_id,
    profile_id: assignments[day.num].id,
    day_of_week: day.num,
    week_number: weekNumber,
    year,
    confirmed: true,
  }))

  const { error } = await supabase.from('cooking_assignments').insert(inserts)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Asignar lavadores (regla: el que cocina no friega) ──────────────────────
  const memberIds = members.map(m => m.id)

  for (const day of DAYS) {
    const cookId = assignments[day.num].id

    // Excluir al cocinero de los disponibles para lavar
    const availableWashers = memberIds.filter(id => id !== cookId)

    if (availableWashers.length === 0) continue

    const washerIndex = (day.num - 1) % availableWashers.length
    const dishWasherId = availableWashers[washerIndex]

    // Si hay más de un disponible, asignar persona diferente para utensilios
    const utensilsWasherId = availableWashers.length > 1
      ? availableWashers[(washerIndex + 1) % availableWashers.length]
      : availableWashers[0]

    await supabase
      .from('cooking_assignments')
      .update({
        dishes_washer_id: dishWasherId,
        utensils_washer_id: utensilsWasherId,
      })
      .eq('family_id', family_id)
      .eq('day_of_week', day.num)
      .eq('week_number', weekNumber)
      .eq('year', year)
  }

  // Actualizar cook_id en weekly_menu donde ya hay entradas
  const weekStart = getLunesDeSemana()
  for (const day of DAYS) {
    await supabase
      .from('weekly_menu')
      .update({
        cook_id: assignments[day.num].id,
        cook_confirmed: true,
      })
      .eq('family_id', family_id)
      .eq('day_of_week', day.num)
      .eq('week_start', weekStart)
  }

  const saved = DAYS.map((day) => ({
    day_num: day.num,
    day_name: day.name,
    cook_id: assignments[day.num].id,
    cook_name: assignments[day.num].name,
    cook_color: assignments[day.num].avatar_color,
  }))

  return NextResponse.json({ success: true, assignments: saved })
}

// GET — obtener asignaciones confirmadas de la semana actual
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const family_id = searchParams.get('family_id')

  const weekNumber = getWeekNumber(new Date())
  const year = new Date().getFullYear()

  const { data } = await supabase
    .from('cooking_assignments')
    .select('*, profiles(id, name, avatar_color)')
    .eq('family_id', family_id!)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .order('day_of_week')

  return NextResponse.json({ assignments: data || [] })
}
