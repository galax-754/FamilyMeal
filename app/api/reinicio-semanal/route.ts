export const dynamic = 'force-dynamic'

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
  const supabase = await createClient()
  const { family_id } = await req.json()

  if (!family_id) {
    return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
  }

  const weekNumber = getWeekNumber(new Date())
  const year = new Date().getFullYear()

  // Si ya existe estado para esta semana, no hacer nada
  const { data: existing } = await supabase
    .from('weekly_voting_status')
    .select('id')
    .eq('family_id', family_id)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ message: 'Semana ya iniciada', week_number: weekNumber })
  }

  // Crear nuevo estado semanal
  await supabase
    .from('weekly_voting_status')
    .insert({
      family_id,
      week_number: weekNumber,
      year,
      recipes_generated: false,
      voting_started: false,
      voting_completed: false,
      menu_completed: false,
      desayunos_matched: 0,
      comidas_matched: 0,
      cenas_matched: 0,
    })

  // Limpiar cooking_assignments de semanas anteriores (conservar la anterior)
  await supabase
    .from('cooking_assignments')
    .delete()
    .eq('family_id', family_id)
    .lt('week_number', weekNumber - 1)

  // Limpiar weekly_menu de semanas viejas (conservar las 2 anteriores)
  await supabase
    .from('weekly_menu')
    .delete()
    .eq('family_id', family_id)
    .lt('week_number', weekNumber - 2)

  return NextResponse.json({
    success: true,
    message: 'Nueva semana iniciada',
    week_number: weekNumber,
  })
}
