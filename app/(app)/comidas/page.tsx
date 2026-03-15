'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { getWeekStart, toDateString } from '@/lib/utils'

const FILTERS: Array<{ value: MealCategory | 'todas'; label: string }> = [
  { value: 'todas',    label: 'Todas' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida',   label: 'Comida' },
  { value: 'cena',     label: 'Cena' },
  { value: 'snack',    label: 'Snack' },
]

const TARGET = 7
const CONFETTI_COLORS = ['#f59e0b', '#22c55e', '#60a5fa', '#ef4444', '#a78bfa', '#fb923c', '#34d399']
const CATEGORY_NAMES: Record<string, string> = {
  desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena',
}

type Modo = 'lista' | 'swipe'

interface VotingProgress {
  desayunos: number
  comidas: number
  cenas: number
}

function ComidasContent() {
  const searchParams = useSearchParams()
  const initialModo = searchParams.get('modo') === 'votar' ? 'swipe' : 'lista'

  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MealCategory | 'todas'>('todas')
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>(initialModo)

  const [members, setMembers] = useState<Profile[]>([])
  const [swipeVotes, setSwipeVotes] = useState<SwipeVote[]>([])
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [showMatch, setShowMatch] = useState(false)
  const [matchedMealName, setMatchedMealName] = useState('')
  const [matchedDay, setMatchedDay] = useState('')
  const [matchedCategory, setMatchedCategory] = useState('')
  const [swipingMealId, setSwipingMealId] = useState<string | null>(null)
  const [progress, setProgress] = useState<VotingProgress>({ desayunos: 0, comidas: 0, cenas: 0 })
  const [menuCompleto, setMenuCompleto] = useState(false)

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
      const weekStart = toDateString(getWeekStart())

      const [
        { data, error: err },
        { data: mems },
        { data: votes },
        { data: weeklyMenu },
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
          .from('meal_votes')
          .select('*')
          .eq('family_id', prof.family_id)
          .eq('week_number', semana)
          .eq('year', anio),
        supabase
          .from('weekly_menu')
          .select('meal_type')
          .eq('family_id', prof.family_id)
          .eq('week_start', weekStart),
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

      const entries = weeklyMenu ?? []
      const prog = {
        desayunos: entries.filter((e) => e.meal_type === 'desayuno').length,
        comidas:   entries.filter((e) => e.meal_type === 'comida').length,
        cenas:     entries.filter((e) => e.meal_type === 'cena').length,
      }
      setProgress(prog)
      setMenuCompleto(prog.desayunos + prog.comidas + prog.cenas >= 21)

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

  const handleSwipeVote = async (mealId: string, voto: boolean) => {
    if (!userId || !familyId || swipingMealId) return
    setSwipingMealId(mealId)
    try {
      const { isMatch, assignedDay, assignedCategory } = await registrarVoto(
        supabase, mealId, userId, familyId, voto
      )

      const semana = getWeekNumber(new Date())
      const anio = new Date().getFullYear()
      const { data: freshVotes } = await supabase
        .from('meal_votes')
        .select('*')
        .eq('family_id', familyId)
        .eq('week_number', semana)
        .eq('year', anio)

      setSwipeVotes((freshVotes ?? []) as SwipeVote[])

      if (isMatch) {
        const matchedMeal = meals.find((m) => m.id === mealId)
        setMatchedMealName(matchedMeal?.name ?? 'La comida')
        setMatchedDay(assignedDay ?? '')
        setMatchedCategory(assignedCategory ?? '')
        setShowMatch(true)

        setProgress((prev) => {
          const cat = assignedCategory ?? ''
          const next = {
            desayunos: prev.desayunos + (cat === 'desayuno' ? 1 : 0),
            comidas:   prev.comidas   + (cat === 'comida'   ? 1 : 0),
            cenas:     prev.cenas     + (cat === 'cena'     ? 1 : 0),
          }
          const total = next.desayunos + next.comidas + next.cenas
          if (total >= 21) {
            setTimeout(() => { setShowMatch(false); setMenuCompleto(true) }, 2500)
          } else {
            setTimeout(() => setShowMatch(false), 2500)
          }
          return next
        })
      }

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

  const totalMatches = progress.desayunos + progress.comidas + progress.cenas

  return (
    <div>
      <PageHeader
        title={modo === 'swipe' ? 'Votando el menú' : 'Comidas'}
        action={
          modo === 'lista' ? (
            <Link href="/comidas/nueva" className="btn-add-header">
              <Plus style={{ width: 20, height: 20 }} />
              Nueva
            </Link>
          ) : undefined
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

        {/* ── MODO LISTA ──────────────────────────────────── */}
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
                    <MealCard meal={meal} onVote={handleVote} showVote />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MODO SWIPE ──────────────────────────────────── */}
        {modo === 'swipe' && (
          <>
            {/* Progreso de votación */}
            {!loading && (
              <div className="voting-progress-card">
                <div className="voting-progress-header">
                  <span className="voting-progress-title">Menú semanal</span>
                  <span className="voting-progress-count">{totalMatches} / 21 matches</span>
                </div>
                <div className="voting-categories">
                  {([
                    { label: 'Desayunos', count: progress.desayunos },
                    { label: 'Comidas',   count: progress.comidas },
                    { label: 'Cenas',     count: progress.cenas },
                  ] as const).map(({ label, count }) => (
                    <div key={label} className="voting-cat-row">
                      <span className="voting-cat-label">{label}</span>
                      <div className="voting-cat-dots">
                        {Array.from({ length: TARGET }).map((_, i) => (
                          <div
                            key={i}
                            className={`voting-dot${i < count ? ' voting-dot-filled' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="voting-cat-fraction">{count}/{TARGET}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="stack-4"><MealCardSkeleton /></div>
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

      {/* ── OVERLAY DE MATCH ──────────────────────────────── */}
      {showMatch && (
        <div className="match-overlay" onClick={() => setShowMatch(false)}>
          <div className="match-confetti">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${(i / 24) * 100}%`,
                  animationDelay: `${(i % 6) * 0.12}s`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  transform: `rotate(${i * 15}deg)`,
                }}
              />
            ))}
          </div>
          <div className="match-emoji">🎉</div>
          <h2 className="match-title">¡Match familiar!</h2>
          <p className="match-subtitle">
            <span className="match-meal-name">{matchedMealName}</span>
          </p>
          {matchedDay && (
            <p className="match-day-text">
              irá el {matchedDay} · {CATEGORY_NAMES[matchedCategory] ?? matchedCategory}
            </p>
          )}
          <p style={{ color: 'var(--hint)', fontSize: '12px', marginTop: '16px' }}>
            Toca para continuar
          </p>
        </div>
      )}

      {/* ── PANTALLA MENÚ COMPLETO ─────────────────────────── */}
      {menuCompleto && !showMatch && (
        <div className="match-overlay" style={{ cursor: 'default' }}>
          <div className="match-confetti">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${(i / 30) * 100}%`,
                  animationDelay: `${(i % 8) * 0.1}s`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  animationDuration: '3s',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 72, marginBottom: 8 }}>🎊</div>
          <h2 className="match-title">¡Menú completo!</h2>
          <p className="match-subtitle" style={{ marginBottom: 8 }}>
            Las 21 comidas de la semana están listas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, width: '100%', maxWidth: 280 }}>
            <Link
              href="/menu"
              className="btn-primary"
              style={{ textAlign: 'center', padding: '14px 24px', borderRadius: 'var(--r)', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}
            >
              Ver mi menú de la semana →
            </Link>
            <button
              onClick={() => setMenuCompleto(false)}
              style={{ background: 'none', border: 'none', color: 'var(--hint)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ComidasPage() {
  return (
    <Suspense fallback={<div />}>
      <ComidasContent />
    </Suspense>
  )
}
