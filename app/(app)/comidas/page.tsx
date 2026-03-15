'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Utensils } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealCard } from '@/components/meals/MealCard'
import { SwipeCard } from '@/components/meals/SwipeCard'
import { MealCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage, EmptyState } from '@/components/ui/ErrorMessage'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { registrarVoto, getWeekNumber } from '@/lib/votes'
import { Meal, MealCategory, Profile, SwipeVote } from '@/types'
import { CATEGORY_LABELS } from '@/lib/utils'

const FILTERS: Array<{ value: MealCategory | 'todas'; label: string }> = [
  { value: 'todas',    label: 'Todas' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida',   label: 'Comida' },
  { value: 'cena',     label: 'Cena' },
  { value: 'snack',    label: 'Snack' },
]

type Modo = 'lista' | 'swipe'

export default function ComidasPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MealCategory | 'todas'>('todas')
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('lista')

  // Swipe mode state
  const [members, setMembers] = useState<Profile[]>([])
  const [swipeVotes, setSwipeVotes] = useState<SwipeVote[]>([])
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [showMatch, setShowMatch] = useState(false)
  const [matchedMealName, setMatchedMealName] = useState('')
  const [swipingMealId, setSwipingMealId] = useState<string | null>(null)

  const toast = useToast()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!prof?.family_id) return
      setFamilyId(prof.family_id)

      const semana = getWeekNumber(new Date())
      const anio = new Date().getFullYear()

      const [
        { data, error: err },
        { data: mems },
        { data: votes },
      ] = await Promise.all([
        supabase
          .from('meals')
          .select('*, meal_votes(*), ingredients(*)')
          .eq('family_id', prof.family_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .eq('family_id', prof.family_id)
          .order('created_at'),
        supabase
          .from('swipe_votes')
          .select('*')
          .eq('family_id', prof.family_id)
          .eq('week_number', semana)
          .eq('year', anio),
      ])

      if (err) throw err

      const scored = (data ?? []).map((m) => ({
        ...m,
        vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        my_vote: (m.meal_votes as Array<{ profile_id: string; vote: -1 | 0 | 1 }>)
          .find((v) => v.profile_id === user.id)?.vote ?? null,
      }))

      setMeals(scored)
      setMembers(mems ?? [])
      setSwipeVotes((votes ?? []) as SwipeVote[])

      // Swipe index: start with unvoted meals
      const unvotedIdx = scored.findIndex(
        (m) => !(votes ?? []).some((v) => v.profile_id === user.id && v.meal_id === m.id)
      )
      setSwipeIndex(unvotedIdx >= 0 ? unvotedIdx : 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Lista: voto tradicional ───────────────────────────
  const handleVote = async (mealId: string, vote: -1 | 0 | 1) => {
    if (!userId) return
    try {
      if (vote === 0) {
        await supabase.from('meal_votes').delete()
          .eq('meal_id', mealId).eq('profile_id', userId)
      } else {
        await supabase.from('meal_votes').upsert(
          { meal_id: mealId, profile_id: userId, vote },
          { onConflict: 'meal_id,profile_id' }
        )
      }
      setMeals((prev) =>
        prev.map((m) => {
          if (m.id !== mealId) return m
          const oldVote = m.my_vote ?? 0
          const newScore = (m.vote_score ?? 0) - oldVote + vote
          return { ...m, my_vote: vote === 0 ? null : vote, vote_score: newScore }
        })
      )
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo 🔄')
    }
  }

  // ── Swipe: voto match ─────────────────────────────────
  const handleSwipeVote = async (mealId: string, voto: boolean) => {
    if (!userId || !familyId || swipingMealId) return
    setSwipingMealId(mealId)
    try {
      const { isMatch } = await registrarVoto(supabase, mealId, userId, familyId, voto)

      const semana = getWeekNumber(new Date())
      const anio = new Date().getFullYear()
      const { data: freshVotes } = await supabase
        .from('swipe_votes')
        .select('*')
        .eq('family_id', familyId)
        .eq('week_number', semana)
        .eq('year', anio)

      setSwipeVotes((freshVotes ?? []) as SwipeVote[])

      if (isMatch) {
        const matchedMeal = meals.find((m) => m.id === mealId)
        setMatchedMealName(matchedMeal?.name ?? 'La comida')
        setShowMatch(true)
        setTimeout(() => setShowMatch(false), 2500)
      }

      // Avanzar al siguiente
      setSwipeIndex((prev) => {
        for (let i = 1; i < meals.length; i++) {
          const next = (prev + i) % meals.length
          const alreadyVoted = (freshVotes ?? []).some(
            (v) => v.profile_id === userId && v.meal_id === meals[next].id
          )
          if (!alreadyVoted) return next
        }
        return (prev + 1) % meals.length
      })
    } catch {
      toast.error('No se pudo guardar el voto.')
    } finally {
      setSwipingMealId(null)
    }
  }

  // ── Lista filtrada ────────────────────────────────────
  const filtered = meals.filter((m) => {
    const matchesFilter = filter === 'todas' || m.category === filter
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const swipeMeal = meals[swipeIndex] ?? null
  const currentUserVotedSwipe = swipeMeal
    ? swipeVotes.some((v) => v.profile_id === userId && v.meal_id === swipeMeal.id)
    : false
  const swipeMealVotes = swipeMeal
    ? swipeVotes.filter((v) => v.meal_id === swipeMeal.id)
    : []

  return (
    <div>
      <PageHeader
        title="Comidas"
        action={
          <Link href="/comidas/nueva" className="btn-add-header">
            <Plus style={{ width: 20, height: 20 }} />
            Nueva
          </Link>
        }
      />

      <div className="page-content stack-4">
        {/* Toggle de modo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="mode-toggle">
            <button
              className={`toggle-btn${modo === 'lista' ? ' active' : ''}`}
              onClick={() => setModo('lista')}
            >
              ☰ Lista
            </button>
            <button
              className={`toggle-btn${modo === 'swipe' ? ' active' : ''}`}
              onClick={() => setModo('swipe')}
            >
              ♥ Votar
            </button>
          </div>
        </div>

        {/* ── MODO LISTA ─────────────────────────────── */}
        {modo === 'lista' && (
          <>
            <div className="search-box">
              <Search className="search-icon" style={{ width: 20, height: 20 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar comidas..."
                className="input search-input"
              />
            </div>

            <div className="filter-row">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as MealCategory | 'todas')}
                  className={`filter-chip${filter === value ? ' active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="stack-4">
                {[1, 2, 3].map((i) => <MealCardSkeleton key={i} />)}
              </div>
            ) : error ? (
              <ErrorMessage type="generic" onRetry={load} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={search
                  ? <Search style={{ width: 40, height: 40 }} />
                  : <Utensils style={{ width: 40, height: 40 }} />
                }
                title={search ? `Sin resultados para "${search}"` : 'Aún no hay comidas'}
                description={search ? 'Prueba con otro nombre' : 'Agrega la primera comida de tu familia'}
                action={!search ? { label: 'Agregar comida', onClick: () => window.location.href = '/comidas/nueva' } : undefined}
              />
            ) : (
              <div className="stack-4">
                <p className="count-label">{filtered.length} comida{filtered.length !== 1 ? 's' : ''}</p>
                {filtered.map((meal) => (
                  <div key={meal.id}>
                    {meal.is_diabetic_friendly && (
                      <div style={{ marginBottom: 6 }}>
                        <span className="badge badge-green">🩺 Apto diabético</span>
                      </div>
                    )}
                    <MealCard
                      meal={meal}
                      onVote={handleVote}
                      showVote
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MODO SWIPE ─────────────────────────────── */}
        {modo === 'swipe' && (
          <>
            {loading ? (
              <div className="stack-4">
                <MealCardSkeleton />
              </div>
            ) : meals.length === 0 ? (
              <EmptyState
                icon={<Utensils style={{ width: 40, height: 40 }} />}
                title="Sin comidas para votar"
                description="Agrega comidas al catálogo primero"
                action={{ label: 'Agregar comida', onClick: () => window.location.href = '/comidas/nueva' }}
              />
            ) : (
              <div className="swipe-mode-container">
                <p className="swipe-counter">
                  {swipeIndex + 1} / {meals.length} comidas
                </p>

                {swipeMeal && (
                  <SwipeCard
                    key={`${swipeMeal.id}-${swipeIndex}`}
                    meal={swipeMeal}
                    members={members}
                    swipeVotes={swipeMealVotes}
                    currentUserId={userId ?? ''}
                    onLike={(id) => handleSwipeVote(id, true)}
                    onPass={(id) => handleSwipeVote(id, false)}
                  />
                )}

                {currentUserVotedSwipe && (
                  <p className="swipe-voted-hint">
                    Ya votaste esta semana — igual puedes deslizar para ver la siguiente
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── OVERLAY DE MATCH ──────────────────────── */}
      {showMatch && (
        <div className="match-overlay" onClick={() => setShowMatch(false)}>
          <div className="match-emoji">🎉</div>
          <h2 className="match-title">¡Match familiar!</h2>
          <p className="match-subtitle">
            <span className="match-meal-name">{matchedMealName}</span>
            {' '}ya está en el menú de esta semana
          </p>
          <p style={{ color: 'var(--hint)', fontSize: '12px', marginTop: '16px' }}>
            Toca para continuar
          </p>
        </div>
      )}
    </div>
  )
}
