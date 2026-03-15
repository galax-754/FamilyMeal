'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, CheckSquare, UtensilsCrossed, ChevronRight,
  Utensils, Sunrise, Sun, Moon, type LucideIcon,
  ShoppingCart, Vote, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealCardSkeleton } from '@/components/ui/Skeleton'
import { FamilySetup } from '@/components/family/FamilySetup'
import { createClient } from '@/lib/supabase/client'
import { Profile, Meal, Chore, WeeklyMenu } from '@/types'
import { getWeekStart, toDateString, DIAS, MEAL_TYPES } from '@/lib/utils'
import { getWeekNumber } from '@/lib/votes'

interface VotingProgress {
  desayunos: number
  comidas: number
  cenas: number
}

interface ShoppingList {
  id: string
  total_estimated_cost: number
  budget_weekly: number
}

export default function InicioPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayMenu, setTodayMenu] = useState<WeeklyMenu[]>([])
  const [pendingChores, setPendingChores] = useState<Chore[]>([])
  const [topMeals, setTopMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [needsFamily, setNeedsFamily] = useState(false)
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null)
  const [budgetGastado, setBudgetGastado] = useState(0)
  const [votingProgress, setVotingProgress] = useState<VotingProgress | null>(null)
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null)

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!prof) return
      setProfile(prof)

      if (!prof.family_id) {
        setNeedsFamily(true)
        setLoading(false)
        return
      }

      const weekStart = getWeekStart()
      const today = new Date()
      const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
      const semana = getWeekNumber(today)
      const anio = today.getFullYear()

      const [
        { data: menu },
        { data: fam },
        { data: weekMenu },
        { data: chores },
        { data: meals },
        { data: shopping },
      ] = await Promise.all([
        supabase
          .from('weekly_menu')
          .select('*, meal:meals(*)')
          .eq('family_id', prof.family_id)
          .eq('week_start', toDateString(weekStart))
          .eq('day_of_week', dayOfWeek),
        supabase
          .from('families')
          .select('budget_weekly')
          .eq('id', prof.family_id)
          .single(),
        supabase
          .from('weekly_menu')
          .select('meal_type, meal:meals(estimated_cost)')
          .eq('family_id', prof.family_id)
          .eq('week_start', toDateString(weekStart)),
        supabase
          .from('chores')
          .select('*, assignee:profiles!chores_assigned_to_fkey(*)')
          .eq('family_id', prof.family_id)
          .eq('completed', false)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(3),
        supabase
          .from('meals')
          .select('*, meal_votes(*)')
          .eq('family_id', prof.family_id)
          .limit(20),
        supabase
          .from('shopping_list')
          .select('id, total_estimated_cost, budget_weekly')
          .eq('family_id', prof.family_id)
          .eq('week_number', semana)
          .eq('year', anio)
          .maybeSingle(),
      ])

      setTodayMenu(menu ?? [])
      setPendingChores(chores ?? [])

      if (fam?.budget_weekly) {
        setBudgetTotal(fam.budget_weekly)
        const totalGastado = (weekMenu ?? []).reduce((sum, entry) => {
          const cost = (entry.meal as { estimated_cost?: number } | null)?.estimated_cost ?? 0
          return sum + cost
        }, 0)
        setBudgetGastado(totalGastado)
      }

      if (meals) {
        const scored = meals.map((m) => ({
          ...m,
          vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        }))
        scored.sort((a, b) => (b.vote_score ?? 0) - (a.vote_score ?? 0))
        setTopMeals(scored.slice(0, 3))
      }

      // Progreso de votación semanal
      const entries = weekMenu ?? []
      setVotingProgress({
        desayunos: entries.filter((e) => e.meal_type === 'desayuno').length,
        comidas:   entries.filter((e) => e.meal_type === 'comida').length,
        cenas:     entries.filter((e) => e.meal_type === 'cena').length,
      })

      setShoppingList(shopping as ShoppingList | null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (needsFamily && profile) {
    return (
      <FamilySetup
        userId={profile.id}
        onComplete={() => { setNeedsFamily(false); load() }}
      />
    )
  }

  const today = new Date()
  const dayName = DIAS[today.getDay() === 0 ? 6 : today.getDay() - 1]
  const totalMatches = votingProgress
    ? votingProgress.desayunos + votingProgress.comidas + votingProgress.cenas
    : 0
  const menuCompleto = totalMatches >= 21

  // Determinar el estado semanal actual
  const getEstadoCard = () => {
    if (!votingProgress) return null

    if (menuCompleto) {
      if (shoppingList) {
        // Estado 6: lista de compras pendiente de usar
        return (
          <Link href="/menu/lista" className="shopping-task-card" style={{ textDecoration: 'none' }}>
            <span className="shopping-task-icon">🛒</span>
            <div className="shopping-task-info">
              <p className="shopping-task-title">Lista de compras lista</p>
              <p className="shopping-task-sub">
                Total estimado: ${shoppingList.total_estimated_cost?.toFixed(0)} MXN
              </p>
            </div>
            <ChevronRight style={{ width: 18, height: 18, color: 'var(--muted)', flexShrink: 0 }} />
          </Link>
        )
      }
      // Estado 5: menú completo
      return (
        <div className="estado-card estado-card-green">
          <p className="estado-card-title">✅ Menú de la semana listo</p>
          <p className="estado-card-subtitle">
            Las 21 comidas están planeadas
          </p>
          <div className="voting-categories" style={{ marginTop: 4 }}>
            {[
              { label: 'Desayunos', count: votingProgress.desayunos },
              { label: 'Comidas',   count: votingProgress.comidas },
              { label: 'Cenas',     count: votingProgress.cenas },
            ].map(({ label, count }) => (
              <div key={label} className="voting-cat-row">
                <span className="voting-cat-label">{label}</span>
                <div className="voting-cat-dots">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`voting-dot${i < count ? ' voting-dot-filled' : ''}`} />
                  ))}
                </div>
                <span className="voting-cat-fraction">{count}/7</span>
              </div>
            ))}
          </div>
          <Link
            href="/menu"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 4,
              padding: '10px',
              background: 'var(--green)',
              color: '#000',
              borderRadius: 'var(--r-sm)',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Ver menú completo →
          </Link>
        </div>
      )
    }

    if (totalMatches > 0) {
      // Estado 4: votando
      return (
        <div className="estado-card estado-card-amber">
          <p className="estado-card-title">🗳️ Votando el menú</p>
          <div className="voting-categories" style={{ marginTop: 4 }}>
            {[
              { label: 'Desayunos', count: votingProgress.desayunos },
              { label: 'Comidas',   count: votingProgress.comidas },
              { label: 'Cenas',     count: votingProgress.cenas },
            ].map(({ label, count }) => (
              <div key={label} className="voting-cat-row">
                <span className="voting-cat-label">{label}</span>
                <div className="voting-cat-dots">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`voting-dot${i < count ? ' voting-dot-filled' : ''}`} />
                  ))}
                </div>
                <span className="voting-cat-fraction">{count}/7</span>
              </div>
            ))}
          </div>
          <Link
            href="/comidas?modo=votar"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 4,
              padding: '10px',
              background: 'var(--amber)',
              color: '#000',
              borderRadius: 'var(--r-sm)',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Seguir votando →
          </Link>
        </div>
      )
    }

    // Estado 3: listo para votar
    return (
      <div className="estado-card estado-card-green">
        <p className="estado-card-title">🗳️ ¡Hora de votar!</p>
        <p className="estado-card-subtitle">
          Ya están listas las recetas de esta semana. ¡Empieza a votar!
        </p>
        <Link
          href="/comidas?modo=votar"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 4,
            padding: '10px',
            background: 'var(--green)',
            color: '#000',
            borderRadius: 'var(--r-sm)',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Votar ahora →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="FamilyMeal"
        subtitle={`${dayName}, ${today.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
      />

      <div className="page-content-spacious stack-6">
        <div className="hero-banner">
          <p className="hero-banner-greeting">¡Hola, {profile?.name?.split(' ')[0] ?? 'Familia'}!</p>
          <p className="hero-banner-title">¿Qué cocinamos hoy?</p>
        </div>

        {/* ── ESTADO SEMANAL ──────────────────────────── */}
        {!loading && votingProgress && (
          <section>
            <div className="section-header">
              <h2 className="section-title flex items-center gap-8">
                <Vote style={{ width: 18, height: 18, color: 'var(--amber)' }} />
                Esta semana
              </h2>
            </div>
            {getEstadoCard()}
          </section>
        )}
        {loading && (
          <section>
            <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          </section>
        )}

        {/* ── MENÚ DE HOY ──────────────────────────────── */}
        <section>
          <div className="section-header">
            <h2 className="section-title flex items-center gap-8">
              <CalendarDays style={{ width: 18, height: 18, color: 'var(--amber)' }} />
              Menú de hoy
            </h2>
            <Link href="/menu" className="section-link flex items-center gap-4">
              Ver semana <ChevronRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>

          {loading ? (
            <div className="stack-2">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-h14" />)}
            </div>
          ) : todayMenu.length === 0 ? (
            <div className="empty-box">
              <p className="empty-box-text">No hay menú asignado para hoy</p>
              <Link href="/comidas?modo=votar" className="empty-box-link">Votar comidas →</Link>
            </div>
          ) : (
            <div className="stack-2">
              {MEAL_TYPES.map(({ key, label, iconKey }) => {
                const MEAL_ICONS: Record<string, LucideIcon> = { Sunrise, Sun, Moon }
                const entry = todayMenu.find((e) => e.meal_type === key)
                if (!entry?.meal) return null
                const MenuIcon = MEAL_ICONS[iconKey]
                return (
                  <div key={key} className="menu-row">
                    <span className="menu-row-emoji">
                      {MenuIcon && <MenuIcon style={{ width: 14, height: 14 }} />}
                    </span>
                    <span className="menu-row-type">{label}</span>
                    <span className="menu-row-name">{entry.meal.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── TAREAS PENDIENTES ────────────────────────── */}
        <section>
          <div className="section-header">
            <h2 className="section-title flex items-center gap-8">
              <CheckSquare style={{ width: 18, height: 18, color: 'var(--amber)' }} />
              Tareas pendientes
              {pendingChores.length > 0 && (
                <span className="section-count-badge">{pendingChores.length}</span>
              )}
            </h2>
            <Link href="/tareas" className="section-link flex items-center gap-4">
              Ver todas <ChevronRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>

          {loading ? (
            <div className="stack-2">
              {[1, 2].map((i) => <div key={i} className="skeleton skeleton-h14" />)}
            </div>
          ) : pendingChores.length === 0 ? (
            <div className="empty-box">
              <p className="empty-box-text">¡Todo al día! Sin tareas pendientes.</p>
            </div>
          ) : (
            <div className="stack-2">
              {pendingChores.map((chore) => (
                <div key={chore.id} className="chore-preview-row">
                  <div className="chore-dot" />
                  <span className="chore-preview-name">{chore.title}</span>
                  {chore.assignee && (
                    <span className="chore-preview-assign">{chore.assignee.name.split(' ')[0]}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── PRESUPUESTO ──────────────────────────────── */}
        {budgetTotal != null && budgetTotal > 0 && (() => {
          const porcentaje = (budgetGastado / budgetTotal) * 100
          const restante = budgetTotal - budgetGastado
          return (
            <section>
              <div className="card">
                <div className="card-row">
                  <span className="section-title">Presupuesto semanal</span>
                  <span className="badge badge-amber">
                    ${budgetGastado.toFixed(0)} / ${budgetTotal.toFixed(0)}
                  </span>
                </div>
                <div className="progress-track" style={{ marginTop: 10 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(porcentaje, 100)}%`,
                      background: porcentaje > 100 ? 'var(--red)' : undefined,
                    }}
                  />
                </div>
                <div className="card-row" style={{ marginTop: 8 }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Restante: ${restante.toFixed(0)} MXN
                  </span>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {Math.round(porcentaje)}% usado
                  </span>
                </div>
              </div>
            </section>
          )
        })()}

        {/* ── FAVORITAS ────────────────────────────────── */}
        <section>
          <div className="section-header">
            <h2 className="section-title flex items-center gap-8">
              <UtensilsCrossed style={{ width: 18, height: 18, color: 'var(--amber)' }} />
              Favoritas de la familia
            </h2>
            <Link href="/comidas" className="section-link flex items-center gap-4">
              Ver todas <ChevronRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>

          {loading ? (
            <div className="stack-3">
              {[1, 2].map((i) => <MealCardSkeleton key={i} />)}
            </div>
          ) : topMeals.length === 0 ? (
            <div className="empty-box">
              <p className="empty-box-text">Agrega y vota tus primeras comidas</p>
              <Link href="/comidas/nueva" className="empty-box-link">Agregar comida →</Link>
            </div>
          ) : (
            <div className="stack-2">
              {topMeals.map((meal) => (
                <Link key={meal.id} href={`/comidas/${meal.id}`} className="top-meal-row">
                  <div className="top-meal-icon"><Utensils style={{ width: 18, height: 18 }} /></div>
                  <div className="top-meal-info">
                    <p className="top-meal-name">{meal.name}</p>
                    <p className="top-meal-cat">{meal.category}</p>
                  </div>
                  {(meal.vote_score ?? 0) !== 0 && (
                    <span className={`top-meal-score ${(meal.vote_score ?? 0) > 0 ? 'top-meal-score-pos' : 'top-meal-score-neg'}`}>
                      {(meal.vote_score ?? 0) > 0 ? '+' : ''}{meal.vote_score}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
