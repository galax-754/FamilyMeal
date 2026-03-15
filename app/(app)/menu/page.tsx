'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { WeeklyGrid } from '@/components/menu/WeeklyGrid'
import { MenuGridSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Meal, WeeklyMenu, MealType } from '@/types'
import { getWeekStart, toDateString, MEAL_TYPES } from '@/lib/utils'

export default function MenuPage() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart())
  const [entries, setEntries] = useState<WeeklyMenu[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loadingSlot, setLoadingSlot] = useState<string | undefined>()
  const [showShuffle, setShowShuffle] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [generatingList, setGeneratingList] = useState(false)

  const toast = useToast()
  const router = useRouter()
  const supabase = createClient()

  const loadFamily = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: prof } = await supabase.from('profiles').select('family_id').eq('id', user.id).single()
    setFamilyId(prof?.family_id ?? null)
    return prof?.family_id ?? null
  }

  const loadMenu = async (fId: string, wStart: Date) => {
    const { data, error: err } = await supabase
      .from('weekly_menu')
      .select('*, meal:meals(*)')
      .eq('family_id', fId)
      .eq('week_start', toDateString(wStart))

    if (err) throw err
    setEntries(data ?? [])
  }

  const loadMeals = async (fId: string) => {
    const { data, error: err } = await supabase
      .from('meals')
      .select('*, meal_votes(*)')
      .eq('family_id', fId)
      .order('name')

    if (err) throw err
    const scored = (data ?? []).map((m) => ({
      ...m,
      vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
    }))
    setMeals(scored)
  }

  const init = async () => {
    setLoading(true)
    setError(false)
    try {
      const fId = await loadFamily()
      if (!fId) return
      await Promise.all([loadMenu(fId, weekStart), loadMeals(fId)])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!familyId) return
    setLoading(true)
    loadMenu(familyId, weekStart)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [weekStart, familyId])

  const handleAssign = async (dayOfWeek: number, mealType: MealType, mealId: string) => {
    if (!familyId) return
    const slotKey = `${dayOfWeek}-${mealType}`
    setLoadingSlot(slotKey)
    try {
      const { error } = await supabase.from('weekly_menu').upsert(
        {
          family_id: familyId,
          week_start: toDateString(weekStart),
          day_of_week: dayOfWeek,
          meal_type: mealType,
          meal_id: mealId,
        },
        { onConflict: 'family_id,week_start,day_of_week,meal_type' }
      )
      if (error) throw error
      await loadMenu(familyId, weekStart)
      toast.success('Menú actualizado correctamente.')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoadingSlot(undefined)
    }
  }

  const handleRemove = async (entryId: string) => {
    if (!familyId) return
    try {
      await supabase.from('weekly_menu').delete().eq('id', entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    }
  }

  const handleShuffle = async () => {
    if (!familyId || meals.length === 0) {
      toast.warning('Agrega comidas primero para poder sortear.')
      return
    }
    setShowShuffle(true)
  }

  const doShuffle = async () => {
    if (!familyId) return
    setShuffling(true)
    try {
      const pool = [...meals].sort(() => Math.random() - 0.5)
      let idx = 0
      const newEntries: Array<{
        family_id: string
        week_start: string
        day_of_week: number
        meal_type: string
        meal_id: string
      }> = []

      for (let day = 0; day < 7; day++) {
        for (const mt of MEAL_TYPES) {
          const meal = pool[idx % pool.length]
          idx++
          newEntries.push({
            family_id: familyId,
            week_start: toDateString(weekStart),
            day_of_week: day,
            meal_type: mt.key,
            meal_id: meal.id,
          })
        }
      }

      await supabase.from('weekly_menu')
        .delete()
        .eq('family_id', familyId)
        .eq('week_start', toDateString(weekStart))

      const { error } = await supabase.from('weekly_menu').insert(newEntries)
      if (error) throw error

      await loadMenu(familyId, weekStart)
      toast.success('Menú sorteado exitosamente.')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setShuffling(false)
      setShowShuffle(false)
    }
  }

  const handleGenerateList = async () => {
    if (!familyId) return
    setGeneratingList(true)
    try {
      const res = await fetch('/api/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al generar la lista')
        return
      }
      router.push('/menu/lista')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setGeneratingList(false)
    }
  }

  return (
    <div>
      <PageHeader title="Menú semanal" />

      <div className="page-content stack-4">
        {loading ? (
          <MenuGridSkeleton />
        ) : error ? (
          <ErrorMessage type="generic" onRetry={init} />
        ) : (
          <>
            <WeeklyGrid
              entries={entries}
              meals={meals}
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              onAssign={handleAssign}
              onRemove={handleRemove}
              onShuffle={handleShuffle}
              loadingSlot={loadingSlot}
            />

            {/* Botón de lista del súper — aparece cuando hay comidas en el menú */}
            {entries.length > 0 && (
              <button
                className="btn-primary"
                onClick={handleGenerateList}
                disabled={generatingList}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <ShoppingCart style={{ width: 18, height: 18 }} />
                {generatingList ? 'Generando lista...' : 'Generar lista del súper'}
              </button>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={showShuffle}
        onClose={() => setShowShuffle(false)}
        onConfirm={doShuffle}
        title="Sortear menú"
        message="¿Quieres reemplazar todo el menú de esta semana con un sorteo aleatorio? Se perderá el menú actual."
        confirmText="¡Sortear!"
        cancelText="Cancelar"
        loading={shuffling}
      />
    </div>
  )
}
