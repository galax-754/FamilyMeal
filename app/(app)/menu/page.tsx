'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sun, Sunset, Moon, ChevronRight,
  Clock, DollarSign, CheckCircle,
  ShoppingCart, Vote, Calendar,
  Shuffle, ChefHat,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLunesDeSemana } from '@/lib/utils'
import { useProfile } from '@/contexts/ProfileContext'

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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

const CATEGORIAS = [
  { key: 'desayuno', label: 'Desayuno', time: '8:00 AM',  Icon: Sun,    iconColor: '#f59e0b' },
  { key: 'comida',   label: 'Comida',   time: '2:00 PM',  Icon: Sunset, iconColor: '#f97316' },
  { key: 'cena',     label: 'Cena',     time: '8:00 PM',  Icon: Moon,   iconColor: '#6366f1' },
]

export default function MenuPage() {
  const router = useRouter()
  const { familyId, isAdmin, loading: profileLoading } = useProfile()
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMatches, setTotalMatches] = useState(0)
  const [generatingList, setGeneratingList] = useState(false)

  useEffect(() => {
    if (profileLoading) return
    if (!familyId) { setLoading(false); return }
    loadMenu()
  }, [profileLoading, familyId])

  async function loadMenu() {
    const supabase = createClient()

    const { data: menu } = await supabase
      .from('weekly_menu')
      .select(`
        id, day_of_week, meal_type, cook_id,
        meals (
          id, name, description, category,
          meal_emoji, image_url, estimated_cost,
          prep_time_minutes, difficulty,
          is_diabetic_friendly, chef_tip,
          ingredients, instructions
        )
      `)
      .eq('family_id', familyId!)
      .eq('week_start', getLunesDeSemana())
      .order('day_of_week')

    setMenuItems(menu || [])
    setTotalMatches(menu?.length || 0)
    setLoading(false)
  }

  function getMealForDay(day: number, category: string) {
    return menuItems.find(item => {
      const meal = Array.isArray(item.meals) ? item.meals[0] : item.meals
      return item.day_of_week === day &&
        item.meal_type === category.toLowerCase() &&
        meal != null
    })
  }

  async function generarListaCompras() {
    setGeneratingList(true)
    try {
      const res = await fetch('/api/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId }),
      })
      const data = await res.json()
      if (data.success) router.push('/tareas')
    } finally {
      setGeneratingList(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="skeleton"
            style={{ height: '120px', marginBottom: '12px', borderRadius: 'var(--r)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{
        padding: '20px 16px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '2px',
          }}>
            Menú semanal
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Semana {getWeekNumber(new Date())} · {totalMatches}/21 comidas
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '50px',
          background: totalMatches >= 21 ? 'rgba(34,197,94,0.1)' : 'var(--amber-soft)',
          border: `1px solid ${totalMatches >= 21 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          <CheckCircle size={14} color={totalMatches >= 21 ? 'var(--green)' : 'var(--amber)'} />
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: totalMatches >= 21 ? 'var(--green)' : 'var(--amber)',
          }}>
            {totalMatches >= 21 ? 'Completo' : `${totalMatches}/21`}
          </span>
        </div>
      </div>

      {/* Banner si no está completo */}
      {totalMatches < 21 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="card">
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              Faltan {21 - totalMatches} comidas para completar el menú.
            </p>
            <button
              className="btn-ghost"
              onClick={() => router.push('/comidas?modo=votar')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Vote size={16} />
              Seguir votando
            </button>
          </div>
        </div>
      )}

      {/* Grid de 7 días */}
      <div style={{ padding: '0 16px' }}>
        {[1, 2, 3, 4, 5, 6, 7].map(day => {
          const items = CATEGORIAS.map(cat => {
            const menuItem = getMealForDay(day, cat.key)
            const meal = menuItem
              ? (Array.isArray(menuItem.meals) ? menuItem.meals[0] : menuItem.meals)
              : null
            return { ...cat, menuItem, meal }
          })
          const hasAny = items.some(i => i.meal)

          return (
            <div key={day} style={{ marginBottom: '20px' }}>

              {/* Header del día */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border)',
              }}>
                <Calendar size={16} color="var(--amber)" />
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                  {DAYS[day]}
                </span>
                {hasAny && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--muted)' }}>
                    {items.filter(i => i.meal).length}/3
                  </span>
                )}
              </div>

              {/* Comidas del día */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map(({ key, label, time, Icon, iconColor, meal }) => (
                  <div
                    key={key}
                    onClick={() => meal && router.push(`/comidas/${meal.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: meal ? 'var(--surface)' : 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      cursor: meal ? 'pointer' : 'default',
                      opacity: meal ? 1 : 0.5,
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Imagen o ícono de categoría */}
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {meal?.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Icon size={24} color={iconColor} strokeWidth={1.5} />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginBottom: '2px',
                      }}>
                        <Icon size={11} color={iconColor} strokeWidth={2} />
                        <span style={{ fontSize: '11px', color: 'var(--hint)' }}>
                          {label} · {time}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: meal ? 'var(--text)' : 'var(--hint)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {meal?.name || 'Sin asignar'}
                      </div>

                      {meal && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '3px',
                        }}>
                          {meal.prep_time_minutes && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={10} color="var(--hint)" />
                              <span style={{ fontSize: '11px', color: 'var(--hint)' }}>
                                {meal.prep_time_minutes} min
                              </span>
                            </div>
                          )}
                          {meal.estimated_cost && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <DollarSign size={10} color="var(--hint)" />
                              <span style={{ fontSize: '11px', color: 'var(--hint)' }}>
                                ${meal.estimated_cost}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {meal && (
                      <ChevronRight size={16} color="var(--hint)" strokeWidth={2} style={{ flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Acciones al final */}
      <div style={{ padding: '8px 16px 0' }}>

        {isAdmin && totalMatches > 0 && (
          <SorteoCocineros familyId={familyId} isAdmin={isAdmin} />
        )}

        {totalMatches >= 21 && (
          <button
            className="btn-primary"
            onClick={generarListaCompras}
            disabled={generatingList}
            style={{
              width: '100%',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <ShoppingCart size={18} />
            {generatingList ? 'Generando lista...' : 'Generar lista del súper'}
          </button>
        )}

        {totalMatches < 21 && (
          <button
            className="btn-ghost"
            onClick={() => router.push('/comidas?modo=votar')}
            style={{
              width: '100%',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Vote size={16} />
            Seguir votando ({21 - totalMatches} faltan)
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sorteo de cocineros ──────────────────────────────────────────────────────

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
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Shuffle size={16} />
          {loading ? 'Sorteando...' : 'Sortear quién cocina cada día'}
        </button>
      )}

      {showPreview && (
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
          }}>
            <ChefHat size={18} color="var(--amber)" />
            Resultado del sorteo
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
                <ChefHat size={16} color="var(--muted)" />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-ghost"
              onClick={sortear}
              disabled={loading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Shuffle size={14} />
              Re-sortear
            </button>
            <button
              className="btn-primary"
              onClick={confirmar}
              disabled={loading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <CheckCircle size={14} />
              Confirmar
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
          <CheckCircle size={18} color="var(--green)" />
          <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
            Sorteo confirmado — ya aparece en Tareas
          </span>
        </div>
      )}
    </div>
  )
}
