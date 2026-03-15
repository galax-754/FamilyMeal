'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckSquare, UtensilsCrossed, ChevronRight, Utensils, Sunrise, Sun, Moon, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealCardSkeleton } from '@/components/ui/Skeleton'
import { FamilySetup } from '@/components/family/FamilySetup'
import { createClient } from '@/lib/supabase/client'
import { Profile, Meal, Chore, WeeklyMenu } from '@/types'
import { getWeekStart, toDateString, DIAS, MEAL_TYPES } from '@/lib/utils'

export default function InicioPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayMenu, setTodayMenu] = useState<WeeklyMenu[]>([])
  const [pendingChores, setPendingChores] = useState<Chore[]>([])
  const [topMeals, setTopMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [needsFamily, setNeedsFamily] = useState(false)
  // Presupuesto
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null)
  const [budgetGastado, setBudgetGastado] = useState(0)

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

      const [{ data: menu }, { data: fam }, { data: weekMenu }] = await Promise.all([
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
          .select('*, meal:meals(estimated_cost)')
          .eq('family_id', prof.family_id)
          .eq('week_start', toDateString(weekStart)),
      ])

      setTodayMenu(menu ?? [])

      if (fam?.budget_weekly) {
        setBudgetTotal(fam.budget_weekly)
        const totalGastado = (weekMenu ?? []).reduce((sum, entry) => {
          const cost = (entry.meal as { estimated_cost?: number } | null)?.estimated_cost ?? 0
          return sum + cost
        }, 0)
        setBudgetGastado(totalGastado)
      }

      const { data: chores } = await supabase
        .from('chores')
        .select('*, assignee:profiles!chores_assigned_to_fkey(*)')
        .eq('family_id', prof.family_id)
        .eq('completed', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3)

      setPendingChores(chores ?? [])

      const { data: meals } = await supabase
        .from('meals')
        .select('*, meal_votes(*)')
        .eq('family_id', prof.family_id)
        .limit(20)

      if (meals) {
        const scored = meals.map((m) => ({
          ...m,
          vote_score: (m.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        }))
        scored.sort((a, b) => (b.vote_score ?? 0) - (a.vote_score ?? 0))
        setTopMeals(scored.slice(0, 3))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (needsFamily && profile) {
    return (
      <FamilySetup
        userId={profile.id}
        onComplete={() => {
          setNeedsFamily(false)
          load()
        }}
      />
    )
  }

  const today = new Date()
  const dayName = DIAS[today.getDay() === 0 ? 6 : today.getDay() - 1]

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
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton skeleton-h14" />
              ))}
            </div>
          ) : todayMenu.length === 0 ? (
            <div className="empty-box">
              <p className="empty-box-text">No hay menú asignado para hoy</p>
              <Link href="/menu" className="empty-box-link">Planear ahora →</Link>
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
                    <span className="menu-row-emoji">{MenuIcon && <MenuIcon style={{ width: 14, height: 14 }} />}</span>
                    <span className="menu-row-type">{label}</span>
                    <span className="menu-row-name">{entry.meal.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

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
                <div className="progress-track" style={{ marginTop: '10px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(porcentaje, 100)}%`,
                      background: porcentaje > 100 ? 'var(--red)' : undefined,
                    }}
                  />
                </div>
                <div className="card-row" style={{ marginTop: '8px' }}>
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    Restante: ${restante.toFixed(0)} MXN
                  </span>
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    {Math.round(porcentaje)}% usado
                  </span>
                </div>
              </div>
            </section>
          )
        })()}

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
