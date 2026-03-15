'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Utensils } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealCard } from '@/components/meals/MealCard'
import { SwipeCard } from '@/components/meals/SwipeCard'
import { MatchCelebration } from '@/components/meals/MatchCelebration'
import { MealCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage, EmptyState } from '@/components/ui/ErrorMessage'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Meal, MealCategory, Profile, SwipeVote } from '@/types'
import { getWeekStart, toDateString } from '@/lib/utils'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const FILTERS: Array<{ value: MealCategory | 'todas'; label: string }> = [
  { value: 'todas',    label: 'Todas' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida',   label: 'Comida' },
  { value: 'cena',     label: 'Cena' },
  { value: 'snack',    label: 'Snack' },
]


const TARGET = 7

type Modo = 'lista' | 'swipe'

interface VotingProgress {
  desayunos: number
  comidas: number
  cenas: number
}

function ComidasContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
  const [progress, setProgress] = useState<VotingProgress>({ desayunos: 0, comidas: 0, cenas: 0 })
  const [showMatchAnimation, setShowMatchAnimation] = useState(false)
  const [matchMeal, setMatchMeal] = useState<{ name: string; category: string; image_url?: string; assignedDay?: number } | null>(null)

  const toast = useToast()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('comidas: sin usuario autenticado')
        setLoading(false)
        return
      }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!prof?.family_id) {
        console.log('comidas: perfil sin family_id', prof)
        setLoading(false)
        return
      }
      setFamilyId(prof.family_id)
      console.log('comidas: familyId =', prof.family_id)

      const weekStart = toDateString(getWeekStart())

      const [
        { data, error: err },
        { data: mems },
        { data: votes },
        { data: weeklyMenu },
      ] = await Promise.all([
        supabase
          .from('meals')
          .select('*, meal_votes(*)')
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
          .eq('family_id', prof.family_id),
        supabase
          .from('weekly_menu')
          .select('meal_type')
          .eq('family_id', prof.family_id)
          .eq('week_start', weekStart),
      ])

      console.log('comidas: meals encontradas =', data?.length, '| error =', err)
      if (err) throw err

      const scored = (data ?? []).map((m) => ({
        ...m,
        // Normalizar categoría a minúscula para que los filtros funcionen
        // independientemente de si Claude devolvió 'Desayuno' o 'desayuno'
        category: (m.category?.toLowerCase() ?? 'comida') as MealCategory,
        vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        my_vote: (m.meal_votes as Array<{ profile_id: string; vote: -1 | 0 | 1 }>)
          .find((v) => v.profile_id === user.id)?.vote ?? null,
      }))

      console.log('comidas: categorías =', scored.map(m => m.category))
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

  const checkForMatch = async (meal: Meal) => {
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    const { data: membersList } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_id', familyId)

    const totalMembers = membersList?.length || 1

    const { data: likes } = await supabase
      .from('meal_votes')
      .select('profile_id')
      .eq('meal_id', meal.id)
      .eq('family_id', familyId)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .eq('vote', true)

    const totalLikes = likes?.length || 0

    console.log(`Match check: ${totalLikes}/${totalMembers} likes para ${meal.name}`)

    if (totalLikes >= totalMembers) {
      await handleMatch(meal)
    }
  }

  const handleMatch = async (meal: Meal) => {
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    const { data: existing } = await supabase
      .from('weekly_menu')
      .select('id')
      .eq('meal_id', meal.id)
      .eq('family_id', familyId)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .maybeSingle()

    if (existing) return

    const { data: assignedDays } = await supabase
      .from('weekly_menu')
      .select('day_of_week, meals(category)')
      .eq('family_id', familyId)
      .eq('week_number', weekNumber)
      .eq('year', year)

    const daysUsedForCategory = assignedDays
      ?.filter(a => {
        const m = Array.isArray(a.meals) ? a.meals[0] : a.meals
        return (m as { category?: string } | null)?.category === meal.category
      })
      .map(a => a.day_of_week) || []

    let nextDay: number | null = null
    for (let d = 1; d <= 7; d++) {
      if (!daysUsedForCategory.includes(d)) {
        nextDay = d
        break
      }
    }

    if (!nextDay) return

    const { error } = await supabase
      .from('weekly_menu')
      .insert({
        family_id: familyId,
        meal_id: meal.id,
        day_of_week: nextDay,
        week_number: weekNumber,
        year,
        auto_assigned: true
      })

    if (!error) {
      const field = meal.category === 'desayuno'
        ? 'desayunos_matched'
        : meal.category === 'comida'
        ? 'comidas_matched'
        : 'cenas_matched'

      await supabase.rpc('increment_match_count', {
        p_family_id: familyId,
        p_week_number: weekNumber,
        p_year: year,
        p_field: field
      })

      const mealConDia = { ...meal, assignedDay: nextDay }
      setMatchMeal(mealConDia)
      setShowMatchAnimation(true)

      setProgress(prev => ({
        ...prev,
        [field.replace('_matched', '')]: (prev[field.replace('_matched', '') as keyof VotingProgress] || 0) + 1
      }))
    }
  }

  const handleSwipeVote = async (liked: boolean) => {
    if (!userId || !familyId) return
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const currentMeal = meals[swipeIndex]
    if (!currentMeal) return

    const { error: voteError } = await supabase
      .from('meal_votes')
      .upsert({
        profile_id: userId,
        meal_id: currentMeal.id,
        family_id: familyId,
        vote: liked,
        week_number: weekNumber,
        year
      }, {
        onConflict: 'profile_id,meal_id,week_number,year'
      })

    if (voteError) {
      console.error('Error guardando voto:', voteError)
    }

    if (liked) {
      await checkForMatch(currentMeal)
    }

    setSwipeIndex(prev => prev + 1)
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
            {totalMatches >= 21 ? (
              /* ── MENÚ COMPLETO ── */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '70vh',
                textAlign: 'center',
                padding: '0 16px',
              }}>
                <div style={{ fontSize: '72px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}>
                  ¡Menú completo!
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--muted)',
                  marginBottom: '32px',
                  lineHeight: 1.6,
                }}>
                  Las 21 comidas de la semana están listas.
                  Ya pueden ver el menú y generar la lista del súper.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => router.push('/menu')}
                >
                  Ver menú de la semana →
                </button>
              </div>
            ) : (
              <>
                {/* Progreso de votación */}
                {!loading && (
                  <div className="card" style={{ margin: '0 0 4px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                        Menú semanal
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amber)' }}>
                        {totalMatches}/21 matches
                      </span>
                    </div>

                    {[
                      { label: 'Desayunos', matched: progress.desayunos, emoji: '🌅' },
                      { label: 'Comidas',   matched: progress.comidas,   emoji: '☀️' },
                      { label: 'Cenas',     matched: progress.cenas,     emoji: '🌙' },
                    ].map(({ label, matched, emoji }) => (
                      <div key={label} style={{ marginBottom: '8px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '3px',
                        }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {emoji} {label}
                          </span>
                          <span style={{
                            fontSize: '12px',
                            color: matched === TARGET ? 'var(--green)' : 'var(--muted)',
                            fontWeight: 600,
                          }}>
                            {matched}/{TARGET}{matched === TARGET ? ' ✓' : ''}
                          </span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: 'var(--surface2)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${(matched / TARGET) * 100}%`,
                            background: matched === TARGET
                              ? 'var(--green)'
                              : 'linear-gradient(90deg, var(--amber), #f97316)',
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    ))}
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
                        onLike={() => handleSwipeVote(true)}
                        onPass={() => handleSwipeVote(false)}
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
          </>
        )}
      </div>

      {/* ── ANIMACIÓN DE MATCH ──────────────────────────────── */}
      {showMatchAnimation && matchMeal && (
        <MatchCelebration
          meal={matchMeal}
          onClose={() => {
            setShowMatchAnimation(false)
            setMatchMeal(null)
          }}
        />
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
