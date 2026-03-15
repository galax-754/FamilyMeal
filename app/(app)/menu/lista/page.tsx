'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, ExternalLink, ShoppingCart, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { getWeekNumber } from '@/lib/votes'
import { formatWeekRange, getWeekStart } from '@/lib/utils'
import type { ShoppingItem } from '@/app/api/lista-compras/route'

const CATEGORY_ICONS: Record<string, string> = {
  'Frutas': '🍎',
  'Verduras': '🥦',
  'Pollo y pavo': '🍗',
  'Res y cerdo': '🥩',
  'Pescados y mariscos': '🐟',
  'Lácteos y huevo': '🥚',
  'Cereales y granos': '🌾',
  'Leguminosas': '🫘',
  'Aceites y grasas': '🫙',
  'Especias y condimentos': '🧂',
  'Salsas y condimentos': '🍶',
  'Enlatados y conservas': '🥫',
  'Otros': '🛒',
}

interface ShoppingList {
  id: string
  family_id: string
  week_number: number
  year: number
  items: ShoppingItem[]
  total_estimated_cost: number
  budget_weekly: number
  generated_at: string
}

function generateWhatsAppText(
  items: ShoppingItem[],
  totalCost: number,
  weekNumber: number
): string {
  // Agrupar en texto
  const grouped: Record<string, ShoppingItem[]> = {}
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }

  let text = `🛒 *Lista del súper - Semana ${weekNumber}*\n`
  if (totalCost > 0) text += `💰 Total estimado: $${totalCost} MXN\n`
  text += '\n'

  for (const [category, catItems] of Object.entries(grouped)) {
    const icon = CATEGORY_ICONS[category] || '🛒'
    text += `${icon} *${category}*\n`
    for (const item of catItems) {
      const qty = `${item.quantity} ${item.unit}`
      const name = item.heb_product_name || item.ingredient_name
      const price = item.estimated_price > 0 ? ` ~$${item.estimated_price}` : ''
      const check = item.checked ? '✅' : '•'
      text += `  ${check} ${name} (${qty})${price}\n`
    }
    text += '\n'
  }

  text += '_Generado con FamilyMeal 🍽️_'
  return text
}

export default function ListaComprasPage() {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(null)

  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  const weekNumber = getWeekNumber(new Date())
  const weekRange = formatWeekRange(getWeekStart())

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!prof?.family_id) return
      setFamilyId(prof.family_id)

      const { data } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('family_id', prof.family_id)
        .eq('week_number', weekNumber)
        .eq('year', new Date().getFullYear())
        .single()

      if (data) {
        setList(data as ShoppingList)
        setItems(data.items as ShoppingItem[])
      }
    } catch {
      // no list yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const handleGenerate = async () => {
    if (!familyId) return
    setGenerating(true)
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
      // Recargar desde la base de datos para tener el objeto completo
      await loadList()
      toast.success('Lista generada exitosamente')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const handleToggleItem = async (index: number) => {
    if (!familyId) return
    const newItems = [...items]
    newItems[index] = { ...newItems[index], checked: !newItems[index].checked }
    setItems(newItems)

    try {
      await fetch('/api/lista-compras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_id: familyId,
          item_index: index,
          checked: newItems[index].checked,
        }),
      })
    } catch {
      // revert on error
      setItems(items)
    }
  }

  const handleOpenHEB = (searchName: string) => {
    const query = encodeURIComponent(searchName)
    window.open(`https://www.heb.com.mx/search?q=${query}`, '_blank')
  }

  const handleCopyWhatsApp = async () => {
    if (!list) return
    const text = generateWhatsAppText(items, list.total_estimated_cost, list.week_number)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Lista copiada al portapapeles')
    } catch {
      toast.error('No se pudo copiar. Intenta manualmente.')
    }
  }

  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  // Agrupar items por categoría (preservando orden)
  const grouped: Record<string, { item: ShoppingItem; originalIndex: number }[]> = {}
  items.forEach((item, idx) => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push({ item, originalIndex: idx })
  })

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Lista del súper"
          back
          backHref="/menu"
        />
        <div className="page-content stack-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-sm)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div>
        <PageHeader
          title="Lista del súper"
          back
          backHref="/menu"
        />
        <div className="page-content" style={{ textAlign: 'center', paddingTop: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Sin lista para esta semana
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Asigna comidas al menú semanal y luego genera la lista automáticamente.
          </p>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: '100%' }}
          >
            {generating ? (
              <>
                <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                Generando...
              </>
            ) : (
              <>
                <ShoppingCart style={{ width: 16, height: 16 }} />
                Generar lista ahora
              </>
            )}
          </button>
          <button
            className="btn-ghost"
            onClick={() => router.push('/menu')}
            style={{ width: '100%', marginTop: 12 }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Ver menú semanal
          </button>
        </div>
      </div>
    )
  }

  const budgetPct = list.budget_weekly > 0
    ? Math.min(Math.round((list.total_estimated_cost / list.budget_weekly) * 100), 999)
    : 0
  const withinBudget = list.budget_weekly > 0 && list.total_estimated_cost <= list.budget_weekly

  return (
    <div>
      <PageHeader
        title="Lista del súper"
        back
        backHref="/menu"
        action={
          <button
            className="btn-icon"
            onClick={handleGenerate}
            disabled={generating}
            title="Regenerar lista"
          >
            <RefreshCw
              style={{
                width: 18, height: 18,
                animation: generating ? 'spin 1s linear infinite' : undefined,
              }}
            />
          </button>
        }
      />

      <div className="page-content stack-4" style={{ paddingBottom: 120 }}>

        {/* Badge de semana + acciones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="badge badge-dark" style={{ fontSize: 12 }}>
            Semana {list.week_number} · {weekRange}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-sm btn-ghost"
              onClick={handleCopyWhatsApp}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <Copy style={{ width: 13, height: 13 }} />
              WhatsApp
            </button>
            <button
              className="btn-sm btn-ghost"
              onClick={() => window.open('https://www.heb.com.mx', '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <ExternalLink style={{ width: 13, height: 13 }} />
              HEB
            </button>
          </div>
        </div>

        {/* Cards de resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Total estimado
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>
              {list.total_estimated_cost > 0 ? `$${list.total_estimated_cost}` : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--hint)', marginTop: 2 }}>MXN</p>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Presupuesto
            </p>
            <p style={{
              fontSize: 22,
              fontWeight: 800,
              color: list.budget_weekly > 0
                ? (withinBudget ? 'var(--green)' : 'var(--red)')
                : 'var(--hint)',
            }}>
              {list.budget_weekly > 0 ? `$${list.budget_weekly}` : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--hint)', marginTop: 2 }}>
              {list.budget_weekly > 0
                ? (withinBudget ? '✓ Dentro del presupuesto' : '✕ Excede el presupuesto')
                : 'Sin presupuesto'}
            </p>
          </div>
        </div>

        {/* Barra de presupuesto */}
        {list.budget_weekly > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Uso del presupuesto</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: withinBudget ? 'var(--green)' : 'var(--red)' }}>
                {budgetPct}%
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(budgetPct, 100)}%`,
                  background: withinBudget ? 'var(--green)' : 'var(--red)',
                }}
              />
            </div>
          </div>
        )}

        {/* Lista agrupada por categoría */}
        {totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
            <p>No se encontraron ingredientes en el menú.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Asegúrate de que las comidas tengan ingredientes cargados.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <div className="shopping-category-header">
                <span>{CATEGORY_ICONS[category] || '🛒'}</span>
                <span>{category}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {catItems.filter((ci) => ci.item.checked).length}/{catItems.length}
                </span>
              </div>

              {catItems.map(({ item, originalIndex }) => (
                <div
                  key={originalIndex}
                  className={`shopping-item${item.checked ? ' checked' : ''}`}
                  onClick={() => handleToggleItem(originalIndex)}
                >
                  {/* Checkbox */}
                  <div className={`item-checkbox${item.checked ? ' checked' : ''}`}>
                    {item.checked && '✓'}
                  </div>

                  {/* Nombre + original */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="item-name">{item.heb_search_name}</p>
                    {item.heb_product_name && item.heb_product_name !== item.ingredient_name && (
                      <p className="item-original-name">{item.ingredient_name}</p>
                    )}
                    {item.used_in_meals.length > 0 && (
                      <p className="item-original-name" style={{ color: 'var(--hint)' }}>
                        {item.used_in_meals.slice(0, 2).join(', ')}
                        {item.used_in_meals.length > 2 && ` +${item.used_in_meals.length - 2}`}
                      </p>
                    )}
                  </div>

                  {/* Cantidad */}
                  <span className="item-qty-badge">
                    {item.quantity} {item.unit}
                  </span>

                  {/* Precio */}
                  {item.estimated_price > 0 && (
                    <span className="item-price">${item.estimated_price}</span>
                  )}

                  {/* Badge HEB + botón abrir */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {item.found_in_heb ? (
                      <span className="heb-badge-found">En HEB</span>
                    ) : (
                      <span className="heb-badge-search">Buscar</span>
                    )}
                    <button
                      className="btn-icon"
                      style={{ padding: 4, opacity: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenHEB(item.heb_search_name)
                      }}
                      title={`Buscar "${item.heb_search_name}" en HEB`}
                    >
                      <ExternalLink style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer fijo con progreso de compra */}
      {totalCount > 0 && (
        <div className="shopping-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {checkedCount} de {totalCount} productos comprados
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: progressPct === 100 ? 'var(--green)' : 'var(--amber)' }}>
              {progressPct}%
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100 ? 'var(--green)' : 'var(--amber)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {progressPct === 100 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--green)', marginTop: 8, fontWeight: 600 }}>
              ¡Lista completa! 🎉
            </p>
          )}
        </div>
      )}
    </div>
  )
}
