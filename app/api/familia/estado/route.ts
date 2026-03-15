export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getWeekNumber } from '@/lib/votes'
import { getWeekStart, toDateString } from '@/lib/utils'

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

    const semana = getWeekNumber(new Date())
    const anio = new Date().getFullYear()
    const weekStart = toDateString(getWeekStart())

    const [
      { data: members },
      { data: prefs },
      { data: weekMenu },
      { data: shoppingList },
    ] = await Promise.all([
      supabase.from('profiles').select('id, name').eq('family_id', family_id),
      supabase
        .from('user_preferences')
        .select('profile_id')
        .eq('family_id', family_id)
        .eq('week_number', semana)
        .eq('year', anio),
      supabase
        .from('weekly_menu')
        .select('meal_type')
        .eq('family_id', family_id)
        .eq('week_start', weekStart),
      supabase
        .from('shopping_list')
        .select('id, total_estimated_cost')
        .eq('family_id', family_id)
        .eq('week_number', semana)
        .eq('year', anio)
        .maybeSingle(),
    ])

    const membersList = members ?? []
    const prefsList = prefs ?? []
    const entries = weekMenu ?? []

    const filledPrefs = membersList.map((m) => ({
      id: m.id,
      name: m.name,
      filled: prefsList.some((p: { profile_id: string }) => p.profile_id === m.id),
    }))

    const progress = {
      desayunos: entries.filter((e) => e.meal_type === 'desayuno').length,
      comidas:   entries.filter((e) => e.meal_type === 'comida').length,
      cenas:     entries.filter((e) => e.meal_type === 'cena').length,
    }
    const totalMatches = progress.desayunos + progress.comidas + progress.cenas
    const allPrefsComplete = filledPrefs.every((m) => m.filled)

    return NextResponse.json({
      week_number: semana,
      year: anio,
      members_count: membersList.length,
      prefs_filled: prefsList.length,
      all_prefs_complete: allPrefsComplete,
      members_prefs: filledPrefs,
      voting_progress: progress,
      total_matches: totalMatches,
      menu_completo: totalMatches >= 21,
      shopping_list: shoppingList ?? null,
    })
  } catch (err) {
    console.error('[api/familia/estado]', err)
    return NextResponse.json({ error: 'Error al obtener el estado' }, { status: 500 })
  }
}
