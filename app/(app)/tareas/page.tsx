'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, ShoppingBag, Check, Copy,
  ExternalLink, ChevronDown, ChevronUp,
  DollarSign, Package, RefreshCw,
  Apple, Leaf, Fish, Wheat, Droplets,
  FlaskConical, Archive, Tag, Utensils,
  Egg, Vote, Clock,
  ChefHat, CalendarDays, ArrowRight,
  type LucideIcon,
} from 'lucide-react'

// ─── Mapeo de categorías a iconos Lucide ──────────────────────────────────────

const CATEGORY_META: Record<string, { Icon: LucideIcon; color: string }> = {
  'Frutas':                 { Icon: Apple,       color: '#f87171' },
  'Verduras':               { Icon: Leaf,        color: '#4ade80' },
  'Pollo y pavo':           { Icon: Utensils,    color: '#fb923c' },
  'Res y cerdo':            { Icon: Tag,         color: '#f43f5e' },
  'Pescados y mariscos':    { Icon: Fish,        color: '#38bdf8' },
  'Lácteos y huevo':        { Icon: Egg,         color: '#facc15' },
  'Cereales y granos':      { Icon: Wheat,       color: '#d97706' },
  'Leguminosas':            { Icon: Package,     color: '#a78bfa' },
  'Aceites y grasas':       { Icon: Droplets,    color: '#fb923c' },
  'Especias y condimentos': { Icon: FlaskConical,color: '#e879f9' },
  'Salsas y condimentos':   { Icon: FlaskConical,color: '#c084fc' },
  'Enlatados y conservas':  { Icon: Archive,     color: '#94a3b8' },
  'Otros':                  { Icon: Package,     color: '#64748b' },
}

const CATEGORY_ORDER = [
  'Frutas', 'Verduras', 'Pollo y pavo',
  'Res y cerdo', 'Pescados y mariscos',
  'Lácteos y huevo', 'Cereales y granos',
  'Leguminosas', 'Aceites y grasas',
  'Especias y condimentos', 'Salsas y condimentos',
  'Enlatados y conservas', 'Otros',
]

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getTodayDayOfWeek(): number {
  const day = new Date().getDay()
  return day === 0 ? 7 : day
}

export default function TareasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [shoppingList, setShoppingList] = useState<any>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [familyId, setFamilyId] = useState('')
  const [copied, setCopied] = useState(false)
  const [totalMatches, setTotalMatches] = useState(0)
  const [myDays, setMyDays] = useState<any[]>([])
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [todayMeal, setTodayMeal] = useState<any[]>([])
  const [showAllDays, setShowAllDays] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (!profile?.family_id) { setLoading(false); return }
    setFamilyId(profile.family_id)
    setCurrentUserId(user.id)

    const [{ data: menu }, { data: list }, { data: assignments }] = await Promise.all([
      supabase
        .from('weekly_menu')
        .select('id')
        .eq('family_id', profile.family_id)
        .eq('week_number', weekNumber)
        .eq('year', year),
      supabase
        .from('shopping_list')
        .select('*')
        .eq('family_id', profile.family_id)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .maybeSingle(),
      supabase
        .from('cooking_assignments')
        .select(`
          *,
          profiles!cooking_assignments_profile_id_fkey(id, name, avatar_color),
          dishes_washer:profiles!cooking_assignments_dishes_washer_id_fkey(id, name, avatar_color),
          utensils_washer:profiles!cooking_assignments_utensils_washer_id_fkey(id, name, avatar_color)
        `)
        .eq('family_id', profile.family_id)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .order('day_of_week'),
    ])

    setTotalMatches(menu?.length || 0)
    setAllAssignments(assignments || [])
    setMyDays(assignments?.filter(a => a.profile_id === user.id) || [])

    if (list) {
      setShoppingList(list)
      const saved = localStorage.getItem(`checked_${profile.family_id}_${weekNumber}`)
      if (saved) setCheckedItems(JSON.parse(saved))
    }

    // Ver si hoy le toca cocinar al usuario
    const todayDow = getTodayDayOfWeek()
    const isCookingToday = assignments?.some(
      a => a.day_of_week === todayDow && a.profile_id === user.id
    )

    if (isCookingToday) {
      const { data: todayMeals } = await supabase
        .from('weekly_menu')
        .select('*, meals(id, name, image_url, category, prep_time_minutes)')
        .eq('family_id', profile.family_id)
        .eq('day_of_week', todayDow)
        .eq('week_number', weekNumber)
        .eq('year', year)

      setTodayMeal(todayMeals || [])
    }

    setLoading(false)
  }

  async function generarLista() {
    setGenerating(true)
    try {
      const res = await fetch('/api/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId }),
      })
      const data = await res.json()
      if (data.success) {
        setShoppingList(data)
        setCheckedItems({})
      }
    } catch (err) {
      console.error('Error generando lista:', err)
    } finally {
      setGenerating(false)
    }
  }

  function toggleItem(itemKey: string) {
    const newChecked = { ...checkedItems, [itemKey]: !checkedItems[itemKey] }
    setCheckedItems(newChecked)
    const weekNumber = getWeekNumber(new Date())
    localStorage.setItem(`checked_${familyId}_${weekNumber}`, JSON.stringify(newChecked))
  }

  function toggleCategory(category: string) {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  function openInHEB(searchName: string) {
    window.open(`https://www.heb.com.mx/search?q=${encodeURIComponent(searchName)}`, '_blank')
  }

  function copyForWhatsApp() {
    if (!shoppingList) return
    const weekNumber = getWeekNumber(new Date())
    let text = `*Lista del super - Semana ${weekNumber}*\n`
    text += `Total estimado: $${shoppingList.total_estimated_cost || 0} MXN\n\n`

    const items = shoppingList.items_flat || shoppingList.items || []
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      const cat = item.category || 'Otros'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }

    for (const [cat, catItems] of Object.entries(grouped)) {
      text += `*${cat}*\n`
      for (const item of catItems) {
        const name = item.heb_search_name || item.ingredient_name || item.name
        const price = item.estimated_price > 0 ? ` ~$${item.estimated_price}` : ''
        text += `  - ${name} (${item.quantity} ${item.unit})${price}\n`
      }
      text += '\n'
    }
    text += `_Generado con FamilyMeal_`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Preparar datos ──────────────────────────────────────────────────────────
  const allItems = shoppingList?.items_flat || shoppingList?.items || []
  const grouped: Record<string, any[]> = {}
  for (const item of allItems) {
    const cat = item.category || 'Otros'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  const totalItems = allItems.length
  const checkedCount = Object.values(checkedItems).filter(Boolean).length
  const totalCost = shoppingList?.total_estimated_cost || 0
  const budgetWeekly = shoppingList?.budget_weekly || 0
  const withinBudget = budgetWeekly === 0 || totalCost <= budgetWeekly

  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '80px', marginBottom: '12px', borderRadius: 'var(--r)' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text)', marginBottom: '2px' }}>
          Tareas
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Semana {getWeekNumber(new Date())}
        </p>
      </div>

      {/* ── HOY ME TOCA COCINAR ─────────────────────────────── */}
      {todayMeal.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))',
            border: '1.5px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--r)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ChefHat size={18} color="var(--amber)" />
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--amber)' }}>
                Hoy te toca cocinar
              </span>
            </div>

            {todayMeal.map((item: any) => {
              const meal = Array.isArray(item.meals) ? item.meals[0] : item.meals
              return (
                <div
                  key={item.id}
                  onClick={() => meal && router.push(`/comidas/${meal.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: 'var(--surface)',
                    borderRadius: 'var(--r-sm)',
                    marginBottom: '6px',
                    cursor: meal ? 'pointer' : 'default',
                  }}
                >
                  {meal?.image_url ? (
                    <img
                      src={meal.image_url}
                      alt={meal.name}
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Utensils size={20} color="var(--muted)" strokeWidth={1.5} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--hint)', marginBottom: '2px' }}>
                      {meal?.category}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {meal?.name}
                    </div>
                    {meal?.prep_time_minutes && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Clock size={10} color="var(--hint)" />
                        <span style={{ fontSize: '11px', color: 'var(--hint)' }}>
                          {meal.prep_time_minutes} min
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowRight size={16} color="var(--hint)" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAREAS DE COCINA ────────────────────────────────── */}
      {allAssignments.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Header con toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={16} color="var(--amber)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                Tareas de cocina
              </span>
            </div>
            <button
              onClick={() => setShowAllDays(v => !v)}
              style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--amber)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {showAllDays ? 'Ver solo hoy' : 'Ver toda la semana'}
            </button>
          </div>

          {/* Cards por día */}
          {allAssignments
            .filter(a => showAllDays || a.day_of_week === getTodayDayOfWeek())
            .map((assignment) => {
              const cook = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles
              const dishWasher = Array.isArray(assignment.dishes_washer) ? assignment.dishes_washer[0] : assignment.dishes_washer
              const utensilsWasher = Array.isArray(assignment.utensils_washer) ? assignment.utensils_washer[0] : assignment.utensils_washer
              const isToday = assignment.day_of_week === getTodayDayOfWeek()

              const tasks = [
                { Icon: ChefHat,  label: 'Cocinar',           person: cook,           description: 'Preparar desayuno, comida y cena' },
                { Icon: Utensils, label: 'Lavar platos',      person: dishWasher,     description: 'Lavar los platos después de cada comida' },
                { Icon: Utensils, label: 'Lavar utensilios',  person: utensilsWasher, description: 'Lavar ollas, sartenes y utensilios de cocina' },
              ]

              return (
                <div
                  key={assignment.id}
                  style={{
                    marginBottom: '12px',
                    border: isToday ? '1.5px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
                    borderRadius: 'var(--r)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header del día */}
                  <div style={{
                    padding: '10px 14px',
                    background: isToday ? 'rgba(245,158,11,0.08)' : 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={14} color={isToday ? 'var(--amber)' : 'var(--muted)'} />
                      <span style={{ fontSize: '14px', fontWeight: 800, color: isToday ? 'var(--amber)' : 'var(--text)' }}>
                        {DAYS[assignment.day_of_week]}
                      </span>
                    </div>
                    {isToday && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--amber)',
                        background: 'var(--amber-soft)',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}>
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Tareas del día */}
                  <div style={{ background: 'var(--surface)' }}>
                    {tasks.map(({ Icon, label, person, description }, j) => {
                      const isMe = person?.id === currentUserId
                      return (
                        <div
                          key={j}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            borderTop: '1px solid var(--border)',
                            background: isMe && isToday ? 'rgba(245,158,11,0.04)' : 'transparent',
                          }}
                        >
                          {/* Ícono tarea */}
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isMe ? 'var(--amber-soft)' : 'var(--surface2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Icon size={16} color={isMe ? 'var(--amber)' : 'var(--muted)'} strokeWidth={1.5} />
                          </div>

                          {/* Info tarea */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '1px' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--hint)' }}>
                              {description}
                            </div>
                          </div>

                          {/* Avatar y nombre */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: person?.avatar_color || '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#000',
                              border: isMe ? '2px solid var(--amber)' : 'none',
                            }}>
                              {person?.name?.charAt(0).toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--amber)' : 'var(--text)' }}>
                                {person?.name || 'Sin asignar'}
                              </div>
                              {isMe && (
                                <div style={{ fontSize: '10px', color: 'var(--hint)' }}>tú</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          {/* Mensaje si no hay tareas hoy y no se está mostrando toda la semana */}
          {!showAllDays && allAssignments.every(a => a.day_of_week !== getTodayDayOfWeek()) && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No hay tareas de cocina asignadas para hoy.
            </div>
          )}
        </div>
      )}

      {/* ── SEPARADOR LISTA DEL SÚPER ───────────────────────── */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={16} color="var(--amber)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
            Lista del súper
          </span>
        </div>
      </div>

      {/* Menú incompleto y sin lista */}
      {totalMatches < 21 && !shoppingList && (
        <div style={{ padding: '0 16px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <ShoppingCart
              size={40}
              color="var(--muted)"
              strokeWidth={1.5}
              style={{ margin: '0 auto 12px', display: 'block' }}
            />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Menú incompleto
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Tienen {totalMatches}/21 comidas confirmadas.
              Completa el menú votando para generar la lista de compras.
            </p>
            <button
              className="btn-ghost"
              onClick={() => router.push('/comidas?modo=votar')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Vote size={16} />
              Ir a votar
            </button>
          </div>
        </div>
      )}

      {/* Menú completo pero sin lista generada */}
      {totalMatches >= 21 && !shoppingList && (
        <div style={{ padding: '0 16px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <ShoppingBag
              size={40}
              color="var(--amber)"
              strokeWidth={1.5}
              style={{ margin: '0 auto 12px', display: 'block' }}
            />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Menú listo
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
              Genera la lista de compras con todos los ingredientes de la semana.
            </p>
            <button
              className="btn-primary"
              onClick={generarLista}
              disabled={generating}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ShoppingCart size={18} />
              {generating ? 'Generando lista...' : 'Generar lista del súper'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de compras */}
      {shoppingList && (
        <>
          {/* Resumen de costos */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                  <DollarSign size={14} color="var(--amber)" />
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total estimado
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)' }}>
                  ${totalCost}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--hint)' }}>MXN</div>
              </div>

              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Package size={14} color="var(--muted)" />
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Presupuesto
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: withinBudget ? 'var(--green)' : 'var(--red)' }}>
                  {budgetWeekly > 0 ? `$${budgetWeekly}` : '—'}
                </div>
                <div style={{ fontSize: '11px', color: withinBudget ? 'var(--green)' : 'var(--red)' }}>
                  {budgetWeekly > 0
                    ? (withinBudget ? 'Dentro del presupuesto' : 'Excede el presupuesto')
                    : 'Sin límite definido'}
                </div>
              </div>
            </div>

            {/* Barra de presupuesto */}
            {budgetWeekly > 0 && (
              <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((totalCost / budgetWeekly) * 100, 100)}%`,
                  background: withinBudget ? 'var(--green)' : 'var(--red)',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-ghost"
                onClick={copyForWhatsApp}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
              >
                {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'WhatsApp'}
              </button>

              <button
                className="btn-ghost"
                onClick={() => window.open('https://www.heb.com.mx', '_blank')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
              >
                <ExternalLink size={16} />
                Abrir HEB
              </button>

              <button
                className="btn-ghost"
                onClick={generarLista}
                disabled={generating}
                style={{ width: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Regenerar lista"
              >
                <RefreshCw
                  size={16}
                  style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }}
                />
              </button>
            </div>
          </div>

          {/* Lista por categorías */}
          <div style={{ padding: '0 16px' }}>
            {sortedCategories.map(category => {
              const items = grouped[category]
              const isCollapsed = collapsedCategories[category]
              const categoryChecked = items.filter((_, i) => checkedItems[`${category}-${i}`]).length
              const catMeta = CATEGORY_META[category] ?? { Icon: Package, color: '#64748b' }
              const CatIcon = catMeta.Icon
              const catColor = catMeta.color

              return (
                <div key={category} style={{ marginBottom: '12px' }}>

                  {/* Header de categoría */}
                  <button
                    onClick={() => toggleCategory(category)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 0',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: '8px',
                    }}
                  >
                    <CatIcon size={15} color={catColor} strokeWidth={2} />
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      flex: 1,
                      textAlign: 'left',
                    }}>
                      {category}
                    </span>
                    <span style={{ fontSize: '11px', color: categoryChecked === items.length ? 'var(--green)' : 'var(--hint)' }}>
                      {categoryChecked}/{items.length}
                    </span>
                    {isCollapsed
                      ? <ChevronDown size={14} color="var(--hint)" />
                      : <ChevronUp size={14} color="var(--hint)" />
                    }
                  </button>

                  {/* Items */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {items.map((item, i) => {
                        const itemKey = `${category}-${i}`
                        const isChecked = !!checkedItems[itemKey]
                        const searchName = item.heb_search_name || item.heb_product_name || item.ingredient_name || item.name

                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              background: 'var(--surface)',
                              border: `1px solid ${isChecked ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                              borderRadius: 'var(--r-sm)',
                              opacity: isChecked ? 0.5 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleItem(itemKey)}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: isChecked ? 'none' : '2px solid var(--border-med)',
                                background: isChecked ? 'var(--green)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all 0.2s',
                              }}
                            >
                              {isChecked && <Check size={13} color="white" />}
                            </button>

                            {/* Nombre */}
                            <div style={{ flex: 1, minWidth: 0 }} onClick={() => openInHEB(searchName)}>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--text)',
                                textDecoration: isChecked ? 'line-through' : 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {searchName}
                              </div>
                              {item.ingredient_name && item.ingredient_name !== searchName && (
                                <div style={{ fontSize: '11px', color: 'var(--hint)', marginTop: '1px' }}>
                                  {item.ingredient_name}
                                </div>
                              )}
                            </div>

                            {/* Cantidad */}
                            <div style={{
                              background: 'var(--amber-soft)',
                              border: '1px solid rgba(245,158,11,0.25)',
                              borderRadius: '20px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--amber)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}>
                              {item.quantity} {item.unit}
                            </div>

                            {/* Precio */}
                            {item.estimated_price > 0 && (
                              <div style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '48px', textAlign: 'right', flexShrink: 0 }}>
                                ${item.estimated_price}
                              </div>
                            )}

                            {/* Link HEB */}
                            <button
                              onClick={() => openInHEB(searchName)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                              title={`Buscar en HEB`}
                            >
                              <ExternalLink size={14} color="var(--hint)" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Footer fijo con progreso */}
      {shoppingList && (
        <div style={{
          position: 'fixed',
          bottom: '70px',
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {checkedCount} de {totalItems} productos
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: checkedCount === totalItems ? 'var(--green)' : 'var(--amber)',
              }}>
                {totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%
              </span>
            </div>
            <div style={{ height: '4px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%`,
                background: checkedCount === totalItems
                  ? 'var(--green)'
                  : 'linear-gradient(90deg, var(--amber), var(--amber-dark))',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {checkedCount === totalItems && totalItems > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--green)', fontSize: '13px', fontWeight: 700 }}>
              <Check size={16} />
              Listo
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
