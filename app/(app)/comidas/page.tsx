'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Utensils, CheckCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealCard } from '@/components/meals/MealCard'
import { SwipeCard } from '@/components/meals/SwipeCard'
import { MatchCelebration } from '@/components/meals/MatchCelebration'
import { MealCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage, EmptyState } from '@/components/ui/ErrorMessage'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { getLunesDeSemana } from '@/lib/utils'
import { Meal, MealCategory, Profile, SwipeVote } from '@/types'
function getWeekNumber(date: Date): number {
  // El domingo ya es semana nueva: Dom–Sáb en vez de Lun–Dom (ISO)
  const d = new Date(date)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  const dUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = dUTC.getUTCDay() || 7
  dUTC.setUTCDate(dUTC.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1))
  return Math.ceil((((dUTC.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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
  const [swipeMeals, setSwipeMeals] = useState<Meal[]>([])
  const [existingVotes, setExistingVotes] = useState<SwipeVote[]>([])
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [progress, setProgress] = useState<VotingProgress>({ desayunos: 0, comidas: 0, cenas: 0 })
  const [showMatchAnimation, setShowMatchAnimation] = useState(false)
  const [matchMeal, setMatchMeal] = useState<{ name: string; category: string; image_url?: string; assignedDay?: number } | null>(null)
  const [allVoted, setAllVoted] = useState(false)

  const toast = useToast()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!prof?.family_id) { setLoading(false); return }
      setFamilyId(prof.family_id)

      const weekNumber = getWeekNumber(new Date())
      const year = new Date().getFullYear()

      const [
        { data: mealsData, error: err },
        { data: mems },
        { data: myVotes },
        { data: allVotes },
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
        // Votos del usuario actual esta semana (para saber qué ya votó)
        supabase
          .from('meal_votes')
          .select('meal_id, vote')
          .eq('profile_id', user.id)
          .eq('week_number', weekNumber)
          .eq('year', year),
        // Votos de toda la familia esta semana (para mostrar avatares) — con caché
        (() => {
          const cacheKey = `votes_${prof.family_id}_${weekNumber}`
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            return Promise.resolve({ data: JSON.parse(cached) as SwipeVote[], error: null })
          }
          return supabase
            .from('meal_votes')
            .select('meal_id, profile_id, vote, week_number, year, family_id, id')
            .eq('family_id', prof.family_id)
            .eq('week_number', weekNumber)
            .eq('year', year)
            .then(res => {
              if (res.data) {
                localStorage.setItem(cacheKey, JSON.stringify(res.data))
              }
              return res
            })
        })(),
        // Menú semanal con meal_type directo
        supabase
          .from('weekly_menu')
          .select('meal_id, meal_type')
          .eq('family_id', prof.family_id)
          .eq('week_start', getLunesDeSemana()),
      ])

      if (err) throw err

      const scored = (mealsData ?? []).map((m) => ({
        ...m,
        category: (m.category?.toLowerCase() ?? 'comida') as MealCategory,
        vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        my_vote: (m.meal_votes as Array<{ profile_id: string; vote: -1 | 0 | 1 }>)
          .find((v) => v.profile_id === user.id)?.vote ?? null,
      }))

      // IDs de recetas que el usuario YA votó esta semana
      const votedMealIds = new Set(myVotes?.map(v => v.meal_id) || [])
      console.log('Mis votos existentes:', votedMealIds.size)

      // Solo las recetas que aún NO ha votado → lista del swipe
      const unvoted = scored.filter(m => !votedMealIds.has(m.id))
      console.log('Recetas sin votar:', unvoted.length, '| ya votadas:', votedMealIds.size)

      setMeals(scored)             // todas → modo lista
      setSwipeMeals(unvoted)       // sin votar → modo swipe
      setSwipeIndex(0)             // siempre empieza en 0 (ya filtramos)
      setAllVoted(scored.length > 0 && unvoted.length === 0)
      setMembers(mems ?? [])
      setExistingVotes((allVotes ?? []) as SwipeVote[])

      // Progreso de matches leyendo meal_type directamente
      const entries = weeklyMenu ?? []
      const prog = {
        desayunos: entries.filter(e => e.meal_type === 'desayuno').length,
        comidas:   entries.filter(e => e.meal_type === 'comida').length,
        cenas:     entries.filter(e => e.meal_type === 'cena').length,
      }
      setProgress(prog)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVote = async (mealId: string, vote: -1 | 0 | 1) => {
    if (!userId || !familyId) return
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    try {
      if (vote === 0) {
        await supabase.from('meal_votes').delete()
          .eq('meal_id', mealId).eq('profile_id', userId)
      } else {
        await supabase.from('meal_votes').upsert(
          { meal_id: mealId, profile_id: userId, family_id: familyId, vote, week_number: weekNumber, year },
          { onConflict: 'profile_id,meal_id,week_number,year' }
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

  const checkForMatch = async (meal: Meal, fid: string) => {
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    const { data: membersList } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_id', fid)

    const totalMembers = membersList?.length || 1

    const { data: likes } = await supabase
      .from('meal_votes')
      .select('profile_id')
      .eq('meal_id', meal.id)
      .eq('family_id', fid)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .eq('vote', 1)

    const totalLikes = likes?.length || 0

    console.log(`Match check: ${totalLikes}/${totalMembers} likes para ${meal.name}`)

    if (totalLikes >= totalMembers) {
      await handleMatch(meal)
    }
  }

  const handleMatch = async (meal: Meal) => {
    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const weekStart = getLunesDeSemana()
    const mealType = meal.category.toLowerCase()

    const { data: existing } = await supabase
      .from('weekly_menu')
      .select('id')
      .eq('meal_id', meal.id)
      .eq('family_id', familyId!)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (existing) return

    const { data: assignedDays } = await supabase
      .from('weekly_menu')
      .select('day_of_week, meal_type')
      .eq('family_id', familyId!)
      .eq('week_start', weekStart)

    const daysUsed = assignedDays
      ?.filter(a => a.meal_type === mealType)
      .map(a => a.day_of_week) || []

    let nextDay: number | null = null
    for (let d = 1; d <= 7; d++) {
      if (!daysUsed.includes(d)) {
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
        meal_type: mealType,
        week_start: weekStart,
        week_number: weekNumber,
        year,
        auto_assigned: true,
      })

    if (!error) {
      const field = mealType === 'desayuno'
        ? 'desayunos_matched'
        : mealType === 'comida'
        ? 'comidas_matched'
        : 'cenas_matched'

      await supabase.rpc('increment_match_count', {
        p_family_id: familyId,
        p_week_number: weekNumber,
        p_year: year,
        p_field: field
      })

      setMatchMeal({ ...meal, assignedDay: nextDay })
      setShowMatchAnimation(true)
      setTimeout(() => setShowMatchAnimation(false), 3500)

      setProgress(prev => ({
        ...prev,
        [field.replace('_matched', '')]: (prev[field.replace('_matched', '') as keyof VotingProgress] || 0) + 1
      }))
    }
  }

  const handleSwipeVote = async (liked: boolean) => {
    if (!userId) return

    // Garantizar que tenemos familyId aunque el estado no haya cargado aún
    let currentFamilyId = familyId
    if (!currentFamilyId) {
      console.warn('familyId es null al votar — re-fetching desde profiles')
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', userId)
        .single()

      if (profile?.family_id) {
        setFamilyId(profile.family_id)
        currentFamilyId = profile.family_id
      } else {
        console.error('No se pudo obtener family_id — abortando voto')
        return
      }
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const currentMeal = swipeMeals[swipeIndex]
    if (!currentMeal) return

    console.log('Guardando voto con familyId:', currentFamilyId)

    const { error: voteError } = await supabase
      .from('meal_votes')
      .upsert({
        profile_id: userId,
        meal_id: currentMeal.id,
        family_id: currentFamilyId,
        vote: liked ? 1 : 0,
        week_number: weekNumber,
        year
      }, {
        onConflict: 'profile_id,meal_id,week_number,year'
      })

    if (voteError) {
      console.error('Error guardando voto:', voteError)
    } else {
      console.log('Voto guardado. family_id usado:', currentFamilyId)
    }

    if (liked) {
      await checkForMatch(currentMeal, currentFamilyId)
    }

    const nextIndex = swipeIndex + 1
    setSwipeIndex(nextIndex)
    if (nextIndex >= swipeMeals.length) {
      setAllVoted(true)
    }
  }

  const filtered = meals.filter((m) => {
    const matchesFilter = filter === 'todas' || m.category === filter
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const swipeMeal = swipeMeals[swipeIndex] ?? null
  const swipeMealVotes = swipeMeal
    ? existingVotes.filter((v) => v.meal_id === swipeMeal.id)
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
                ) : (allVoted || swipeMeals.length === 0) ? (
                  /* ── YA VOTASTE TODAS ── */
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <CheckCircle
                      size={52}
                      color="var(--green)"
                      strokeWidth={1.5}
                      style={{ margin: '0 auto 16px' }}
                    />
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                      Ya votaste todo
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>
                      Espera a que los demás terminen.
                    </p>
                    <button className="btn-ghost" onClick={() => router.push('/menu')}>
                      Ver menú →
                    </button>
                  </div>
                ) : (
                  <div className="swipe-mode-container">
                    <p className="swipe-counter">
                      {swipeIndex + 1} / {swipeMeals.length} por votar
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
