import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { searchFoodImage, buildSearchQuery } from '@/lib/images'
import { CLAUDE_API_KEY } from '@/config'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })

export const maxDuration = 60

const RECETAS_POR_CATEGORIA = 3

const CATEGORIA_NOMBRE: Record<string, string> = {
  desayuno: 'Desayuno',
  comida:   'Comida',
  cena:     'Cena',
  snack:    'Snack',
}

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

interface RecetaContext {
  allLikes: Set<string>
  allDislikes: Set<string>
  allAllergies: Set<string>
  hasDiabetic: boolean
  budgetPerMeal: number
  recentMeals: string[]
}

async function generarRecetasParaCategoria(
  categoriaKey: string,
  context: RecetaContext,
): Promise<{ recetas: unknown[] }> {
  const { allLikes, allDislikes, allAllergies, hasDiabetic, budgetPerMeal, recentMeals } = context
  const nombreCategoria = CATEGORIA_NOMBRE[categoriaKey] ?? categoriaKey

  const promptCategoria = `Eres un chef mexicano profesional especializado en cocina saludable y familiar.

Genera ${RECETAS_POR_CATEGORIA} recetas de ${nombreCategoria} para una familia mexicana.

CONTEXTO DE LA FAMILIA:
- Presupuesto por receta: $${budgetPerMeal} MXN
- Les gusta: ${Array.from(allLikes).slice(0, 10).join(', ') || 'variado'}
- No les gusta: ${Array.from(allDislikes).slice(0, 5).join(', ') || 'ninguno'}
- Alergias: ${Array.from(allAllergies).join(', ') || 'ninguna'}
${hasDiabetic ? '- ⚠️ HAY DIABÉTICO: bajo índice glucémico obligatorio en todas las recetas' : ''}

REQUISITOS DE CALIDAD:
- Recetas reales de cocina mexicana casera
- Ingredientes fáciles de conseguir en HEB
- Instrucciones claras paso a paso
- El chef_tip debe ser un truco profesional real que marque diferencia en el resultado final
- No repetir: ${recentMeals.slice(0, 5).join(', ') || 'ninguna'}

Responde SOLO con este JSON sin texto adicional:
{
  "recetas": [
    {
      "name": "Nombre del platillo",
      "description": "Descripción apetitosa en 1-2 oraciones",
      "category": "${categoriaKey}",
      "emoji": "🍳",
      "estimated_cost": ${budgetPerMeal},
      "prep_time_minutes": 25,
      "is_diabetic_friendly": ${hasDiabetic},
      "difficulty": "fácil",
      "ingredients": [
        {
          "name": "nombre exacto del ingrediente",
          "quantity": 2,
          "unit": "pieza",
          "estimated_price_mxn": 20
        }
      ],
      "instructions": [
        {
          "step": 1,
          "title": "Título corto del paso",
          "text": "Instrucción detallada y clara"
        }
      ],
      "chef_tip": "Truco profesional específico para esta receta",
      "tags": ["mexicano", "saludable"]
    }
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content: promptCategoria }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  if (!responseText || responseText.trim() === '') {
    console.error(`Claude devolvió respuesta vacía para categoría: ${categoriaKey}`)
    throw new Error(`Claude no generó respuesta para ${nombreCategoria}`)
  }

  try {
    return parseClaudeJSON(responseText)
  } catch (parseError: unknown) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError)
    console.error(`Error parseando JSON para ${categoriaKey}:`, msg)
    console.error('Respuesta raw (primeros 500 chars):', responseText.substring(0, 500))
    throw new Error(`Error procesando respuesta de IA: ${msg}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      family_id,
      only_categories,
    }: {
      family_id: string
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

    // Cargar datos de contexto en paralelo
    const [
      { data: existingMeals },
      { data: familyPrefs },
      { data: familyData },
    ] = await Promise.all([
      supabase
        .from('meals')
        .select('name')
        .eq('family_id', family_id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('user_preferences')
        .select('likes, dislikes, allergies, is_diabetic')
        .eq('family_id', family_id)
        .eq('preferences_completed', true),
      supabase
        .from('families')
        .select('budget_weekly')
        .eq('id', family_id)
        .single(),
    ])

    // Agregar preferencias de todos los miembros
    const allLikes     = new Set<string>()
    const allDislikes  = new Set<string>()
    const allAllergies = new Set<string>()
    let hasDiabetic    = false

    for (const pref of familyPrefs ?? []) {
      for (const l of (pref.likes     ?? []) as string[]) allLikes.add(l)
      for (const d of (pref.dislikes  ?? []) as string[]) allDislikes.add(d)
      for (const a of (pref.allergies ?? []) as string[]) allAllergies.add(a)
      if (pref.is_diabetic) hasDiabetic = true
    }

    const budgetPerMeal = familyData?.budget_weekly
      ? Math.round((familyData.budget_weekly as number) / 21)
      : 80

    const recentMeals = (existingMeals ?? []).map((m) => m.name)
    const weekNumber  = getWeekNumber(new Date())

    const context: RecetaContext = {
      allLikes,
      allDislikes,
      allAllergies,
      hasDiabetic,
      budgetPerMeal,
      recentMeals,
    }

    // Siempre generar RECETAS_POR_CATEGORIA por categoría
    const categoriasAGenerar = only_categories && only_categories.length > 0
      ? only_categories
      : ['desayuno', 'comida', 'cena']

    // Generar recetas por categoría en llamadas separadas para evitar truncamiento
    const todasLasRecetas: unknown[] = []

    for (const categoriaKey of categoriasAGenerar) {
      const result = await generarRecetasParaCategoria(categoriaKey, context)
      if (result.recetas && Array.isArray(result.recetas)) {
        todasLasRecetas.push(...result.recetas)
      }
    }

    if (todasLasRecetas.length === 0) {
      throw new Error('No se generaron recetas')
    }

    // Buscar imágenes en Unsplash en paralelo
    const imagePromises = todasLasRecetas.map((receta) =>
      searchFoodImage(
        (receta as { name: string; category: string }).name,
        (receta as { name: string; category: string }).category,
      )
    )
    const images = await Promise.all(imagePromises)

    // Guardar recetas con sus imágenes
    const savedMeals = []

    for (let i = 0; i < todasLasRecetas.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receta    = todasLasRecetas[i] as any
      const imageUrl  = images[i]

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          name:                  receta.name,
          description:           receta.description,
          category:              receta.category,
          meal_emoji:            receta.emoji,
          estimated_cost:        receta.estimated_cost,
          prep_time_minutes:     receta.prep_time_minutes,
          is_diabetic_friendly:  receta.is_diabetic_friendly ?? false,
          is_healthy:            true,
          difficulty:            receta.difficulty,
          ingredients:           receta.ingredients,
          instructions:          receta.instructions,
          chef_tip:              receta.chef_tip,
          tags:                  receta.tags,
          image_url:             imageUrl,
          image_search_query:    buildSearchQuery(receta.name, receta.category),
          generated_by_ai:       true,
          family_id,
        })
        .select()
        .single()

      if (!mealError && meal) {
        savedMeals.push(meal)

        // Registrar en historial (no crítico)
        await Promise.resolve(
          supabase.from('generated_meals_history').insert({
            family_id,
            meal_name:   receta.name,
            week_number: weekNumber,
            year:        new Date().getFullYear(),
          })
        ).catch(() => null)
      }
    }

    // Actualizar weekly_voting_status
    const year = new Date().getFullYear()
    await Promise.resolve(
      supabase
        .from('weekly_voting_status')
        .upsert(
          {
            family_id,
            week_number:          weekNumber,
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
      meals:   savedMeals,
      total:   savedMeals.length,
    })
  } catch (error) {
    console.error('Error en generar-recetas:', error)
    return NextResponse.json(
      { error: 'Error al generar recetas. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
