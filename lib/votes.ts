import { SupabaseClient } from '@supabase/supabase-js'
import { getWeekStart, toDateString, DIAS } from './utils'

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Devuelve true si la receta cumple el criterio de match según el match_mode de la familia.
 * Considera solo los votos de la semana indicada.
 */
export async function checkMatch(
  supabase: SupabaseClient,
  mealId: string,
  familyId: string,
  weekNumber: number,
  year: number
): Promise<boolean> {
  const [
    { data: family },
    { data: members },
    { data: likes },
  ] = await Promise.all([
    supabase
      .from('families')
      .select('match_mode')
      .eq('id', familyId)
      .single(),
    supabase
      .from('profiles')
      .select('id')
      .eq('family_id', familyId),
    supabase
      .from('swipe_votes')
      .select('profile_id')
      .eq('meal_id', mealId)
      .eq('family_id', familyId)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .eq('vote', true),
  ])

  const totalMembers = members?.length ?? 0
  const totalLikes = likes?.length ?? 0
  const mode = family?.match_mode ?? 'full'

  if (totalMembers === 0) return false

  if (mode === 'majority') {
    return totalLikes >= Math.ceil(totalMembers / 2)
  }

  return totalLikes >= totalMembers
}

/**
 * Devuelve el primer día de la semana (0-6, 0=Lunes) sin asignación
 * para la categoría indicada. Null si todos los días están ocupados.
 */
export async function getNextAvailableDay(
  supabase: SupabaseClient,
  familyId: string,
  weekStart: string,
  mealType: string
): Promise<number | null> {
  const { data: assigned } = await supabase
    .from('weekly_menu')
    .select('day_of_week')
    .eq('family_id', familyId)
    .eq('week_start', weekStart)
    .eq('meal_type', mealType)

  const daysUsed = assigned?.map((a) => a.day_of_week) ?? []

  for (let day = 0; day <= 6; day++) {
    if (!daysUsed.includes(day)) return day
  }

  return null
}

export async function registrarVoto(
  supabase: SupabaseClient,
  mealId: string,
  profileId: string,
  familyId: string,
  voto: boolean
): Promise<{ isMatch: boolean; assignedDay?: string; assignedCategory?: string }> {
  const semana = getWeekNumber(new Date())
  const anio = new Date().getFullYear()

  await supabase.from('swipe_votes').upsert(
    {
      meal_id: mealId,
      profile_id: profileId,
      family_id: familyId,
      vote: voto,
      week_number: semana,
      year: anio,
    },
    { onConflict: 'meal_id,profile_id,week_number,year' }
  )

  if (!voto) return { isMatch: false }

  const isMatch = await checkMatch(supabase, mealId, familyId, semana, anio)

  if (isMatch) {
    const weekStart = toDateString(getWeekStart())

    const { data: existing } = await supabase
      .from('weekly_menu')
      .select('id')
      .eq('family_id', familyId)
      .eq('meal_id', mealId)
      .eq('week_start', weekStart)

    if (!existing?.length) {
      const { data: meal } = await supabase
        .from('meals')
        .select('category')
        .eq('id', mealId)
        .single()

      const rawCategory = meal?.category ?? 'comida'
      const mealType = (rawCategory === 'snack' ? 'comida' : rawCategory) as 'desayuno' | 'comida' | 'cena'

      const assignedDayIndex = await getNextAvailableDay(supabase, familyId, weekStart, mealType)

      if (assignedDayIndex !== null) {
        await supabase.from('weekly_menu').insert({
          family_id: familyId,
          meal_id: mealId,
          day_of_week: assignedDayIndex,
          meal_type: mealType,
          week_start: weekStart,
        })

        // Sincronizar contadores en weekly_voting_status
        const { data: currentMenu } = await supabase
          .from('weekly_menu')
          .select('meal_type')
          .eq('family_id', familyId)
          .eq('week_start', weekStart)

        const desayunos = currentMenu?.filter((r) => r.meal_type === 'desayuno').length ?? 0
        const comidas   = currentMenu?.filter((r) => r.meal_type === 'comida').length   ?? 0
        const cenas     = currentMenu?.filter((r) => r.meal_type === 'cena').length     ?? 0
        const menuCompleto = desayunos >= 7 && comidas >= 7 && cenas >= 7

        await supabase
          .from('weekly_voting_status')
          .upsert(
            {
              family_id:         familyId,
              week_number:       semana,
              year:              anio,
              desayunos_matched: desayunos,
              comidas_matched:   comidas,
              cenas_matched:     cenas,
              menu_completed:    menuCompleto,
              voting_started:    true,
            },
            { onConflict: 'family_id,week_number,year' }
          )
      }

      const assignedDay = assignedDayIndex !== null ? DIAS[assignedDayIndex] : undefined
      return { isMatch: true, assignedDay, assignedCategory: mealType }
    }
  }

  return { isMatch }
}
