import { SupabaseClient } from '@supabase/supabase-js'
import { getWeekStart, toDateString } from './utils'

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function registrarVoto(
  supabase: SupabaseClient,
  mealId: string,
  profileId: string,
  familyId: string,
  voto: boolean
): Promise<{ isMatch: boolean }> {
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

  const { data: miembros } = await supabase
    .from('profiles')
    .select('id')
    .eq('family_id', familyId)

  const { data: likes } = await supabase
    .from('swipe_votes')
    .select('profile_id')
    .eq('meal_id', mealId)
    .eq('family_id', familyId)
    .eq('week_number', semana)
    .eq('year', anio)
    .eq('vote', true)

  const totalMembers = miembros?.length ?? 0
  const totalLikes = likes?.length ?? 0
  const isMatch = totalMembers > 0 && totalLikes >= totalMembers

  if (isMatch) {
    const weekStart = toDateString(getWeekStart())

    const { data: existing } = await supabase
      .from('weekly_menu')
      .select('id')
      .eq('family_id', familyId)
      .eq('meal_id', mealId)
      .eq('week_start', weekStart)

    if (!existing?.length) {
      const { data: occupied } = await supabase
        .from('weekly_menu')
        .select('day_of_week, meal_type')
        .eq('family_id', familyId)
        .eq('week_start', weekStart)

      const TYPES: Array<'comida' | 'cena' | 'desayuno'> = ['comida', 'cena', 'desayuno']
      let assigned = false

      for (let day = 0; day <= 6 && !assigned; day++) {
        for (const type of TYPES) {
          const isOccupied = (occupied ?? []).some(
            (s) => s.day_of_week === day && s.meal_type === type
          )
          if (!isOccupied) {
            await supabase.from('weekly_menu').insert({
              family_id: familyId,
              meal_id: mealId,
              day_of_week: day,
              meal_type: type,
              week_start: weekStart,
            })
            assigned = true
            break
          }
        }
      }
    }
  }

  return { isMatch }
}
