'use client'

import { useEffect, useState, useCallback } from 'react'
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
  const [isAdmin, setIsAdmin] = useState(false)
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
    const { data: prof } = await supabase.from('profiles').select('family_id, role').eq('id', user.id).single()
    setFamilyId(prof?.family_id ?? null)
    setIsAdmin(prof?.role === 'admin')
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

            {/* Sorteo de cocineros — solo admin */}
            {familyId && (
              <SorteoCocineros familyId={familyId} isAdmin={isAdmin} />
            )}

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

// ─── Componente de sorteo de cocineros ───────────────────────────────────────

interface AssignmentPreview {
  day_num: number
  day_name: string
  cook_id: string
  cook_name: string
  cook_color: string | null
}

function SorteoCocineros({
  familyId,
  isAdmin,
}: {
  familyId: string
  isAdmin: boolean
}) {
  const [preview, setPreview] = useState<AssignmentPreview[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  // Verificar si ya hay sorteo confirmado esta semana
  const checkExisting = useCallback(async () => {
    try {
      const res = await fetch(`/api/sorteo-cocineros?family_id=${familyId}`)
      const data = await res.json()
      if (data.assignments?.length > 0) setConfirmed(true)
    } finally {
      setChecking(false)
    }
  }, [familyId])

  useEffect(() => { checkExisting() }, [checkExisting])

  async function sortear() {
    setLoading(true)
    try {
      const res = await fetch('/api/sorteo-cocineros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId, confirm: false }),
      })
      const data = await res.json()
      setPreview(data.preview)
      setShowPreview(true)
    } finally {
      setLoading(false)
    }
  }

  async function confirmar() {
    setLoading(true)
    try {
      const res = await fetch('/api/sorteo-cocineros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId, confirm: true }),
      })
      const data = await res.json()
      if (data.success) {
        setConfirmed(true)
        setShowPreview(false)
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking || !isAdmin) return null

  return (
    <div style={{ marginTop: '8px' }}>
      {!confirmed && !showPreview && (
        <button
          className="btn-primary"
          onClick={sortear}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Sorteando...' : '🎲 Sortear quién cocina cada día'}
        </button>
      )}

      {showPreview && (
        <div className="card">
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
          }}>
            🎲 Resultado del sorteo
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {preview.map((item) => (
              <div key={item.day_num} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'var(--surface2)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span style={{
                  fontSize: '13px',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  width: '90px',
                }}>
                  {item.day_name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: item.cook_color || '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#000',
                  }}>
                    {item.cook_name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {item.cook_name}
                  </span>
                </div>
                <span style={{ fontSize: '16px' }}>👨‍🍳</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-ghost"
              onClick={sortear}
              disabled={loading}
              style={{ flex: 1 }}
            >
              🔀 Re-sortear
            </button>
            <button
              className="btn-primary"
              onClick={confirmar}
              disabled={loading}
              style={{ flex: 1 }}
            >
              ✅ Confirmar
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
            Sorteo confirmado — ya aparece en Tareas
          </span>
        </div>
      )}
    </div>
  )
}
