import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { searchFoodImage, buildSearchQuery } from '@/lib/images'
import { CLAUDE_API_KEY } from '@/config'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })

export const maxDuration = 60

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function parseClaudeJSON(responseText: string): { recetas: unknown[] } {
  if (!responseText || responseText.trim() === '') {
    throw new Error('Claude devolvió respuesta vacía')
  }

  let clean = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No se encontró JSON en la respuesta')
  }

  clean = clean.substring(firstBrace, lastBrace + 1)
  return JSON.parse(clean)
}

async function generarRecetasParaCategoria(
  categoria: string,
  count: number,
  promptBase: string,
): Promise<{ recetas: unknown[] }> {
  const promptCategoria = `${promptBase}

Genera EXACTAMENTE ${count} recetas de tipo: ${categoria}
Responde SOLO con JSON válido, sin markdown ni texto adicional:
{ "recetas": [...] }`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: promptCategoria }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  if (!responseText || responseText.trim() === '') {
    console.error(`Claude devolvió respuesta vacía para categoría: ${categoria}`)
    throw new Error(`Claude no generó respuesta para ${categoria}`)
  }

  try {
    return parseClaudeJSON(responseText)
  } catch (parseError: unknown) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError)
    console.error(`Error parseando JSON para ${categoria}:`, msg)
    console.error('Respuesta raw (primeros 500 chars):', responseText.substring(0, 500))
    throw new Error(`Error procesando respuesta de IA: ${msg}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      family_id,
      preferences = '',
      is_diabetic_friendly = false,
      only_categories,
    }: {
      family_id: string
      preferences?: string
      is_diabetic_friendly?: boolean
      only_categories?: string[]
    } = body

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (profile?.family_id !== family_id) {
      return NextResponse.json({ error: 'Sin acceso a esta familia' }, { status: 403 })
    }

    const { data: existingMeals } = await supabase
      .from('meals')
      .select('name')
      .eq('family_id', family_id)
      .limit(30)

    const existingNames = (existingMeals ?? []).map((m) => m.name).join(', ')
    const weekNumber = getWeekNumber(new Date())

    const promptBase = `Eres un chef mexicano experto en alimentación familiar saludable.
${is_diabetic_friendly ? 'IMPORTANTE: Todas las recetas deben ser aptas para diabéticos (bajo índice glucémico).' : ''}
${preferences ? `Preferencias de la familia: ${preferences}` : ''}
${existingNames ? `NO repitas estos platillos que ya tienen: ${existingNames}` : ''}

Formato de cada receta en el array "recetas":
{
  "name": "Nombre del platillo",
  "description": "Descripción apetitosa en 1-2 oraciones",
  "category": "desayuno|comida|cena|snack",
  "emoji": "🍽️",
  "estimated_cost": 80,
  "prep_time_minutes": 30,
  "is_diabetic_friendly": false,
  "difficulty": "fácil|medio|difícil",
  "ingredients": [
    { "name": "ingrediente", "quantity": "cantidad", "unit": "unidad" }
  ],
  "instructions": ["Paso 1", "Paso 2", "Paso 3"],
  "chef_tip": "Consejo del chef",
  "tags": ["saludable", "mexicano"]
}`

    // Determinar categorías y cantidades a generar
    let categoryTasks: Array<{ categoria: string; count: number }>

    if (only_categories && only_categories.length > 0) {
      const year = new Date().getFullYear()

      const { data: status } = await supabase
        .from('weekly_voting_status')
        .select('desayunos_matched, comidas_matched, cenas_matched')
        .eq('family_id', family_id)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .maybeSingle()

      const matchedByCategory: Record<string, number> = {
        desayuno: status?.desayunos_matched ?? 0,
        comida:   status?.comidas_matched   ?? 0,
        cena:     status?.cenas_matched     ?? 0,
      }

      categoryTasks = only_categories
        .map((cat) => ({
          categoria: cat,
          count: Math.max(0, 7 - (matchedByCategory[cat] ?? 0)) * 2,
        }))
        .filter((t) => t.count > 0)

      if (categoryTasks.length === 0) {
        return NextResponse.json({
          success: true,
          meals: [],
          total: 0,
          message: 'No se necesitan más recetas para estas categorías',
        })
      }
    } else {
      categoryTasks = [
        { categoria: 'desayuno', count: 7 },
        { categoria: 'comida',   count: 7 },
        { categoria: 'cena',     count: 7 },
      ]
    }

    // Generar recetas por categoría en llamadas separadas para evitar truncamiento
    const todasLasRecetas: unknown[] = []

    for (const { categoria, count } of categoryTasks) {
      const result = await generarRecetasParaCategoria(categoria, count, promptBase)
      if (result.recetas && Array.isArray(result.recetas)) {
        todasLasRecetas.push(...result.recetas)
      }
    }

    if (todasLasRecetas.length === 0) {
      throw new Error('No se generaron recetas')
    }

    // Buscar imágenes en Unsplash en paralelo
    const imagePromises = todasLasRecetas.map((receta) =>
      searchFoodImage((receta as { name: string; category: string }).name, (receta as { name: string; category: string }).category)
    )
    const images = await Promise.all(imagePromises)

    // Guardar recetas con sus imágenes
    const savedMeals = []

    for (let i = 0; i < todasLasRecetas.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receta = todasLasRecetas[i] as any
      const imageUrl = images[i]

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          name: receta.name,
          description: receta.description,
          category: receta.category,
          meal_emoji: receta.emoji,
          estimated_cost: receta.estimated_cost,
          prep_time_minutes: receta.prep_time_minutes,
          is_diabetic_friendly: receta.is_diabetic_friendly ?? false,
          is_healthy: true,
          difficulty: receta.difficulty,
          ingredients: receta.ingredients,
          instructions: receta.instructions,
          chef_tip: receta.chef_tip,
          tags: receta.tags,
          image_url: imageUrl,
          image_search_query: buildSearchQuery(receta.name, receta.category),
          generated_by_ai: true,
          family_id,
        })
        .select()
        .single()

      if (!mealError && meal) {
        savedMeals.push(meal)

        // Registrar en historial (no crítico — falla silenciosamente si la tabla no existe)
        await Promise.resolve(
          supabase.from('generated_meals_history').insert({
            family_id,
            meal_name: receta.name,
            week_number: weekNumber,
            year: new Date().getFullYear(),
          })
        ).catch(() => null)
      }
    }

    // Actualizar weekly_voting_status: recetas generadas y votación activa
    const year = new Date().getFullYear()
    await Promise.resolve(
      supabase
        .from('weekly_voting_status')
        .upsert(
          {
            family_id,
            week_number: weekNumber,
            year,
            recipes_generated:    true,
            recipes_generated_at: new Date().toISOString(),
            voting_started:       true,
          },
          { onConflict: 'family_id,week_number,year' }
        )
    ).catch(() => null)

    return NextResponse.json({
      success: true,
      meals: savedMeals,
      total: savedMeals.length,
    })
  } catch (error) {
    console.error('Error en generar-recetas:', error)
    return NextResponse.json(
      { error: 'Error al generar recetas. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
