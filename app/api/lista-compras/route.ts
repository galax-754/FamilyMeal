import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeekStart, toDateString } from '@/lib/utils'
import { getWeekNumber } from '@/lib/votes'

// Orden lógico de recorrido en tienda
const CATEGORY_ORDER = [
  'Frutas',
  'Verduras',
  'Pollo y pavo',
  'Res y cerdo',
  'Pescados y mariscos',
  'Lácteos y huevo',
  'Cereales y granos',
  'Leguminosas',
  'Aceites y grasas',
  'Especias y condimentos',
  'Salsas y condimentos',
  'Enlatados y conservas',
  'Otros',
]

// Inferir categoría desde el nombre del ingrediente
function inferCategory(name: string): string {
  const n = name.toLowerCase()
  if (/pollo|pavo|pechuga|muslo|pierna|alita/.test(n)) return 'Pollo y pavo'
  if (/res|cerdo|carne|bistec|molida|costilla|chorizo|tocino|jamon/.test(n)) return 'Res y cerdo'
  if (/salmón|salmon|tilapia|atún|atun|camarón|camaron|pescado|marisco/.test(n)) return 'Pescados y mariscos'
  if (/huevo|leche|queso|crema|mantequilla|yogur|requesón/.test(n)) return 'Lácteos y huevo'
  if (/jitomate|tomate|cebolla|ajo|chile|nopal|zanahoria|espinaca|lechuga|aguacate|brócoli|brocoli|calabaza|cilantro|papa|chayote|ejote|betabel|poro|apio|pepino|rábano|rabano/.test(n)) return 'Verduras'
  if (/manzana|naranja|limón|limon|plátano|platano|mango|fresa|uva|melón|melon|sandía|sandia|piña|pina|pera|durazno|kiwi/.test(n)) return 'Frutas'
  if (/arroz|avena|pasta|tortilla|pan|harina|maíz|maiz|trigo|cereal|granola/.test(n)) return 'Cereales y granos'
  if (/frijol|lenteja|garbanzo|haba|chícharo|chicharo/.test(n)) return 'Leguminosas'
  if (/aceite|manteca|margarina/.test(n)) return 'Aceites y grasas'
  if (/sal|pimienta|orégano|oregano|comino|canela|vainilla|azúcar|azucar|ajo en polvo|paprika|laurel|tomillo/.test(n)) return 'Especias y condimentos'
  if (/salsa|ketchup|catsup|mayonesa|mostaza|vinagre|soya|mole|adobo/.test(n)) return 'Salsas y condimentos'
  if (/lata|enlatado|conserva/.test(n)) return 'Enlatados y conservas'
  return 'Otros'
}

function roundQuantity(qty: number): number {
  if (qty < 0.1) return 0.1
  if (qty <= 1) return Math.round(qty * 4) / 4
  if (qty <= 5) return Math.round(qty * 2) / 2
  return Math.round(qty)
}

function parseQuantity(raw: string | number | null | undefined): number {
  if (!raw) return 1
  if (typeof raw === 'number') return raw
  const parsed = parseFloat(raw)
  return isNaN(parsed) ? 1 : parsed
}

export interface ShoppingItem {
  ingredient_name: string
  heb_product_name: string | null
  heb_search_name: string
  quantity: number
  unit: string
  category: string
  estimated_price: number
  price_per_unit: number | null
  found_in_heb: boolean
  used_in_meals: string[]
  checked: boolean
}

// POST — generar y guardar lista para la semana actual
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { family_id } = await req.json()

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (profile?.family_id !== family_id) {
      return NextResponse.json({ error: 'Sin acceso a esta familia' }, { status: 403 })
    }

    const now = new Date()
    const weekStart = getWeekStart(now)
    const weekStartStr = toDateString(weekStart)
    const weekNumber = getWeekNumber(now)
    const year = now.getFullYear()

    // Obtener presupuesto de la familia
    const { data: family } = await supabase
      .from('families')
      .select('budget_weekly')
      .eq('id', family_id)
      .single()

    // Obtener comidas del menú semanal con meal_id
    const { data: menuEntries, error: menuError } = await supabase
      .from('weekly_menu')
      .select('meal_id, day_of_week, meal_type, meal:meals(id, name)')
      .eq('family_id', family_id)
      .eq('week_start', weekStartStr)
      .not('meal_id', 'is', null)

    if (menuError) {
      return NextResponse.json({ error: 'Error al obtener el menú semanal' }, { status: 500 })
    }

    if (!menuEntries || menuEntries.length === 0) {
      return NextResponse.json(
        { error: 'No hay menú confirmado para esta semana. Primero asigna comidas al menú.' },
        { status: 404 }
      )
    }

    // IDs únicos de comidas en el menú
    const mealIdSet = new Set(menuEntries.map((e) => e.meal_id as string).filter(Boolean))
    const mealIds = Array.from(mealIdSet)

    // Nombres de comidas para referenciar en los items
    const mealNameMap = new Map<string, string>()
    for (const entry of menuEntries) {
      const meal = Array.isArray(entry.meal) ? entry.meal[0] : entry.meal
      if (meal && entry.meal_id) {
        mealNameMap.set(entry.meal_id as string, (meal as { id: string; name: string }).name)
      }
    }

    // Obtener ingredientes de la tabla ingredients (relación por meal_id)
    const { data: tableIngredients } = await supabase
      .from('ingredients')
      .select('meal_id, name, quantity, unit')
      .in('meal_id', mealIds)

    // Cruzar con catálogo de HEB si existe (tabla con heb_product_name, price_mxn, category)
    // Si no existe el catálogo, todos los items tendrán found_in_heb = false
    const { data: hebCatalog } = await supabase
      .from('ingredients')
      .select('name, heb_product_name, price_mxn, category')
      .is('meal_id', null) // Ingredientes sin meal_id son del catálogo global
      .limit(500)

    const hebMap = new Map<string, { heb_product_name?: string; price_mxn?: number; category?: string }>()
    if (hebCatalog) {
      for (const heb of hebCatalog) {
        if (heb.name) hebMap.set(heb.name.toLowerCase().trim(), heb)
      }
    }

    // Consolidar ingredientes por nombre (sumando cantidades)
    const ingredientMap = new Map<string, {
      name: string
      quantity: number
      unit: string
      used_in_meals: string[]
    }>()

    for (const ing of tableIngredients ?? []) {
      const key = ing.name.toLowerCase().trim()
      const mealName = mealNameMap.get(ing.meal_id) ?? 'Comida desconocida'
      const qty = parseQuantity(ing.quantity)

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!
        existing.quantity += qty
        if (!existing.used_in_meals.includes(mealName)) {
          existing.used_in_meals.push(mealName)
        }
      } else {
        ingredientMap.set(key, {
          name: ing.name,
          quantity: qty,
          unit: ing.unit || 'pieza',
          used_in_meals: [mealName],
        })
      }
    }

    // Construir items finales
    const items: ShoppingItem[] = []
    let totalCost = 0

    for (const [key, ing] of ingredientMap.entries()) {
      // Buscar coincidencia exacta en catálogo HEB, luego parcial
      let hebMatch = hebMap.get(key)
      if (!hebMatch) {
        for (const [hebKey, hebIng] of hebMap.entries()) {
          if (hebKey.includes(key) || key.includes(hebKey.split(' ')[0])) {
            hebMatch = hebIng
            break
          }
        }
      }

      const pricePerUnit = (hebMatch as { price_mxn?: number } | undefined)?.price_mxn ?? null
      const finalPrice = pricePerUnit ? pricePerUnit * roundQuantity(ing.quantity) : 0
      totalCost += finalPrice

      const category = (hebMatch as { category?: string } | undefined)?.category || inferCategory(ing.name)

      items.push({
        ingredient_name: ing.name,
        heb_product_name: (hebMatch as { heb_product_name?: string } | undefined)?.heb_product_name ?? null,
        heb_search_name: (hebMatch as { heb_product_name?: string } | undefined)?.heb_product_name ?? ing.name,
        quantity: roundQuantity(ing.quantity),
        unit: ing.unit,
        category,
        estimated_price: Math.round(finalPrice * 100) / 100,
        price_per_unit: pricePerUnit,
        found_in_heb: !!hebMatch,
        used_in_meals: ing.used_in_meals,
        checked: false,
      })
    }

    // Ordenar por categoría (orden de pasillo de tienda)
    items.sort((a, b) => {
      const posA = CATEGORY_ORDER.indexOf(a.category)
      const posB = CATEGORY_ORDER.indexOf(b.category)
      const idxA = posA === -1 ? 999 : posA
      const idxB = posB === -1 ? 999 : posB
      if (idxA !== idxB) return idxA - idxB
      return a.heb_search_name.localeCompare(b.heb_search_name, 'es')
    })

    // Agrupar por categoría
    const itemsGrouped: Record<string, ShoppingItem[]> = {}
    for (const item of items) {
      if (!itemsGrouped[item.category]) itemsGrouped[item.category] = []
      itemsGrouped[item.category].push(item)
    }

    const budgetWeekly = (family as { budget_weekly?: number } | null)?.budget_weekly ?? 0
    const totalRounded = Math.round(totalCost * 100) / 100

    // Guardar / actualizar en base de datos
    await supabase
      .from('shopping_list')
      .upsert(
        {
          family_id,
          week_number: weekNumber,
          year,
          items,
          total_estimated_cost: totalRounded,
          budget_weekly: budgetWeekly,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'family_id,week_number,year' }
      )

    return NextResponse.json({
      success: true,
      week_number: weekNumber,
      year,
      total_items: items.length,
      total_estimated_cost: totalRounded,
      budget_weekly: budgetWeekly,
      within_budget: budgetWeekly > 0 ? totalCost <= budgetWeekly : null,
      items_grouped: itemsGrouped,
      items_flat: items,
      meals_included: Array.from(mealNameMap.values()),
    })
  } catch (error) {
    console.error('Error generando lista de compras:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// GET — obtener lista guardada de la semana actual
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const family_id = searchParams.get('family_id')

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const now = new Date()
    const weekNumber = getWeekNumber(now)
    const year = now.getFullYear()

    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('family_id', family_id)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .single()

    return NextResponse.json({ list: data ?? null })
  } catch (error) {
    console.error('Error obteniendo lista:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH — marcar/desmarcar item como comprado
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { family_id, item_index, checked } = await req.json()

    if (!family_id || item_index === undefined) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 })
    }

    const now = new Date()
    const weekNumber = getWeekNumber(now)
    const year = now.getFullYear()

    const { data: current } = await supabase
      .from('shopping_list')
      .select('items')
      .eq('family_id', family_id)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    }

    const items = current.items as ShoppingItem[]
    if (items[item_index] !== undefined) {
      items[item_index].checked = checked
    }

    await supabase
      .from('shopping_list')
      .update({ items })
      .eq('family_id', family_id)
      .eq('week_number', weekNumber)
      .eq('year', year)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizando item:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
