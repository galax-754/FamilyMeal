import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkMatch, getNextAvailableDay, getWeekNumber } from '@/lib/votes'
import { getWeekStart, toDateString } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { family_id } = await request.json()

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id, role')
      .eq('id', user.id)
      .single()

    if (profile?.family_id !== family_id) {
      return NextResponse.json({ error: 'Sin acceso a esta familia' }, { status: 403 })
    }
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el admin puede activar esta opción' }, { status: 403 })
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const weekStart = toDateString(getWeekStart())

    // Cambiar match_mode a 'majority'
    await supabase
      .from('families')
      .update({ match_mode: 'majority' })
      .eq('id', family_id)

    // Obtener todos los meal_id con votos positivos esta semana
    const { data: votedMeals } = await supabase
      .from('swipe_votes')
      .select('meal_id')
      .eq('family_id', family_id)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .eq('vote', true)

    const uniqueMealIds = [...new Set(votedMeals?.map((v) => v.meal_id) ?? [])]
    let newMatches = 0

    for (const mealId of uniqueMealIds) {
      // Saltar si ya está en el menú esta semana
      const { data: existing } = await supabase
        .from('weekly_menu')
        .select('id')
        .eq('meal_id', mealId)
        .eq('family_id', family_id)
        .eq('week_start', weekStart)
        .maybeSingle()

      if (existing) continue

      const isMatch = await checkMatch(supabase, mealId, family_id, weekNumber, year)
      if (!isMatch) continue

      const { data: meal } = await supabase
        .from('meals')
        .select('category')
        .eq('id', mealId)
        .single()

      const rawCategory = meal?.category ?? 'comida'
      const mealType = rawCategory === 'snack' ? 'comida' : rawCategory

      const dayAssigned = await getNextAvailableDay(supabase, family_id, weekStart, mealType)
      if (dayAssigned === null) continue

      const { error: insertError } = await supabase
        .from('weekly_menu')
        .insert({
          family_id,
          meal_id: mealId,
          day_of_week: dayAssigned,
          meal_type: mealType,
          week_start: weekStart,
        })

      if (!insertError) newMatches++
    }

    // Actualizar contadores en weekly_voting_status
    if (newMatches > 0) {
      const { data: currentMenu } = await supabase
        .from('weekly_menu')
        .select('meal_type')
        .eq('family_id', family_id)
        .eq('week_start', weekStart)

      const desayunos = currentMenu?.filter((r) => r.meal_type === 'desayuno').length ?? 0
      const comidas = currentMenu?.filter((r) => r.meal_type === 'comida').length ?? 0
      const cenas = currentMenu?.filter((r) => r.meal_type === 'cena').length ?? 0
      const menuCompleto = desayunos >= 7 && comidas >= 7 && cenas >= 7

      await supabase
        .from('weekly_voting_status')
        .update({
          desayunos_matched: desayunos,
          comidas_matched: comidas,
          cenas_matched: cenas,
          menu_completed: menuCompleto,
        })
        .eq('family_id', family_id)
        .eq('week_number', weekNumber)
        .eq('year', year)
    }

    return NextResponse.json({ success: true, new_matches: newMatches })
  } catch (error) {
    console.error('Error en activar-mayoria:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
