import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNextAvailableDay, getWeekNumber } from '@/lib/votes'
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
      return NextResponse.json({ error: 'Solo el admin puede completar el menú' }, { status: 403 })
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const weekStart = toDateString(getWeekStart())

    // Calcular qué días faltan por categoría
    const { data: currentMenu } = await supabase
      .from('weekly_menu')
      .select('day_of_week, meal_type')
      .eq('family_id', family_id)
      .eq('week_start', weekStart)

    const getDaysByType = (type: string) =>
      currentMenu?.filter((r) => r.meal_type === type).map((r) => r.day_of_week) ?? []

    const DAYS = [0, 1, 2, 3, 4, 5, 6]
    const missingByType: Record<string, number[]> = {
      desayuno: DAYS.filter((d) => !getDaysByType('desayuno').includes(d)),
      comida:   DAYS.filter((d) => !getDaysByType('comida').includes(d)),
      cena:     DAYS.filter((d) => !getDaysByType('cena').includes(d)),
    }

    let totalAssigned = 0

    for (const [mealType, missingDays] of Object.entries(missingByType)) {
      if (missingDays.length === 0) continue

      // Obtener las recetas con más likes que no estén ya en el menú
      const { data: topMeals, error: rpcError } = await supabase.rpc('get_top_voted_meals', {
        p_family_id:   family_id,
        p_week_number: weekNumber,
        p_year:        year,
        p_week_start:  weekStart,
        p_category:    mealType,
        p_limit:       missingDays.length,
      })

      if (rpcError || !topMeals?.length) continue

      for (let i = 0; i < missingDays.length; i++) {
        const top = topMeals[i]
        if (!top) break

        // Verificar que el slot no esté ya ocupado por otra receta asignada antes en este loop
        const dayFree = await getNextAvailableDay(supabase, family_id, weekStart, mealType)
        if (dayFree === null) break

        const { error: insertError } = await supabase
          .from('weekly_menu')
          .insert({
            family_id,
            meal_id:      top.meal_id,
            day_of_week:  missingDays[i],
            meal_type:    mealType,
            week_start:   weekStart,
            auto_assigned: true,
          })

        if (!insertError) totalAssigned++
      }
    }

    // Actualizar weekly_voting_status
    if (totalAssigned > 0) {
      const { data: updatedMenu } = await supabase
        .from('weekly_menu')
        .select('meal_type')
        .eq('family_id', family_id)
        .eq('week_start', weekStart)

      const desayunos = updatedMenu?.filter((r) => r.meal_type === 'desayuno').length ?? 0
      const comidas   = updatedMenu?.filter((r) => r.meal_type === 'comida').length ?? 0
      const cenas     = updatedMenu?.filter((r) => r.meal_type === 'cena').length ?? 0
      const menuCompleto = desayunos >= 7 && comidas >= 7 && cenas >= 7

      await supabase
        .from('weekly_voting_status')
        .update({
          desayunos_matched: desayunos,
          comidas_matched:   comidas,
          cenas_matched:     cenas,
          menu_completed:    menuCompleto,
        })
        .eq('family_id', family_id)
        .eq('week_number', weekNumber)
        .eq('year', year)
    }

    return NextResponse.json({ success: true, assigned: totalAssigned })
  } catch (error) {
    console.error('Error en completar-menu:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
