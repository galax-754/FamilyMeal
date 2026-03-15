import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { searchFoodImage, buildSearchQuery } from '@/lib/images'
import { CLAUDE_API_KEY } from '@/config'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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

    // Verificar que el usuario pertenece a esta familia
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

    // Obtener comidas existentes para no repetir
    const { data: existingMeals } = await supabase
      .from('meals')
      .select('name')
      .eq('family_id', family_id)
      .limit(30)

    const existingNames = (existingMeals ?? []).map((m) => m.name).join(', ')
    const weekNumber = getWeekNumber(new Date())

    // Calcular cuántas recetas por categoría se necesitan (modo completar)
    let categoryBlock = ''
    let totalCount = 7

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

      const distribution: string[] = []
      totalCount = 0

      for (const cat of only_categories) {
        const needed = Math.max(0, 7 - (matchedByCategory[cat] ?? 0))
        if (needed === 0) continue
        const toGenerate = needed * 2
        distribution.push(`${toGenerate} de tipo "${cat}"`)
        totalCount += toGenerate
      }

      if (totalCount === 0) {
        return NextResponse.json({
          success: true,
          meals: [],
          total: 0,
          message: 'No se necesitan más recetas para estas categorías',
        })
      }

      categoryBlock = `
Genera SOLO recetas de tipo: ${only_categories.join(', ')}.
Necesito exactamente ${totalCount} recetas en total distribuidas así: ${distribution.join(', ')}.
Ya tenemos estas recetas esta semana, NO repetir: ${existingNames || 'ninguna'}.`
    }

    // Construir prompt
    const prompt = `Eres un chef mexicano experto en alimentación familiar saludable.
${only_categories
  ? `Genera ${totalCount} recetas adicionales para completar el menú semanal.`
  : 'Genera 7 recetas variadas para una semana (desayuno, comida, cena, snack).'}
${is_diabetic_friendly ? 'IMPORTANTE: Todas deben ser aptas para diabéticos (bajo índice glucémico).' : ''}
${preferences ? `Preferencias de la familia: ${preferences}` : ''}
${!only_categories && existingNames ? `NO repitas estos platillos que ya tienen: ${existingNames}` : ''}
${categoryBlock}

Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional:
{
  "recetas": [
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
    }
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const recetas = JSON.parse(cleaned)

    if (!recetas.recetas || !Array.isArray(recetas.recetas)) {
      throw new Error('Formato de respuesta inválido de Claude')
    }

    // Buscar imágenes en Unsplash en paralelo
    const imagePromises = recetas.recetas.map((receta: { name: string; category: string }) =>
      searchFoodImage(receta.name, receta.category)
    )
    const images = await Promise.all(imagePromises)

    // Guardar recetas con sus imágenes
    const savedMeals = []

    for (let i = 0; i < recetas.recetas.length; i++) {
      const receta = recetas.recetas[i]
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
