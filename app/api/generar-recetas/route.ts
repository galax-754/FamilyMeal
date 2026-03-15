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
  const lastBrace  = clean.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No se encontró JSON en la respuesta')
  }

  clean = clean.substring(firstBrace, lastBrace + 1)
  return JSON.parse(clean)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { family_id }: { family_id: string } = body

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

    // Cargar contexto en paralelo
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
        .limit(20),
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

    // Una sola llamada: 3 recetas (1 desayuno, 1 comida, 1 cena)
    const prompt = `Eres chef mexicano profesional.
Genera exactamente 3 recetas para familia mexicana:
1 Desayuno, 1 Comida, 1 Cena.

FAMILIA:
- Presupuesto por receta: $${budgetPerMeal} MXN
- Les gusta: ${Array.from(allLikes).slice(0, 8).join(', ') || 'variado'}
- No les gusta: ${Array.from(allDislikes).slice(0, 5).join(', ') || 'ninguno'}
- Alergias: ${Array.from(allAllergies).join(', ') || 'ninguna'}
${hasDiabetic ? '- Todas deben ser aptas para diabéticos' : ''}
- No repetir: ${recentMeals.slice(0, 5).join(', ') || 'ninguna'}

Responde SOLO con JSON sin texto adicional:
{
  "recetas": [
    {
      "name": "Nombre",
      "description": "Una oración apetitosa",
      "category": "desayuno",
      "emoji": "🍳",
      "estimated_cost": 80,
      "prep_time_minutes": 20,
      "is_diabetic_friendly": false,
      "difficulty": "fácil",
      "ingredients": [
        {"name": "ingrediente", "quantity": 1, "unit": "pieza", "estimated_price_mxn": 20}
      ],
      "instructions": [
        {"step": 1, "title": "Título", "text": "Instrucción clara"}
      ],
      "chef_tip": "Tip profesional breve",
      "tags": ["mexicano"]
    }
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    if (!responseText || responseText.trim() === '') {
      console.error('Claude devolvió respuesta vacía en generar-recetas')
      return NextResponse.json({ error: 'Claude no generó respuesta' }, { status: 500 })
    }

    let parsed: { recetas: unknown[] }
    try {
      parsed = parseClaudeJSON(responseText)
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError)
      console.error('Error parseando JSON:', msg)
      console.error('Respuesta raw (primeros 500 chars):', responseText.substring(0, 500))
      return NextResponse.json(
        { error: 'Error procesando respuesta de IA: ' + msg },
        { status: 500 }
      )
    }

    if (!parsed.recetas || !Array.isArray(parsed.recetas)) {
      return NextResponse.json({ error: 'Formato de respuesta inválido' }, { status: 500 })
    }

    // Buscar imágenes en Unsplash en paralelo
    const imagePromises = parsed.recetas.map((receta) =>
      searchFoodImage(
        (receta as { name: string; category: string }).name,
        (receta as { name: string; category: string }).category,
      )
    )
    const images = await Promise.all(imagePromises)

    // Guardar recetas
    const savedMeals = []

    for (let i = 0; i < parsed.recetas.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receta   = parsed.recetas[i] as any
      const imageUrl = images[i]

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          name:                 receta.name,
          description:          receta.description,
          category:             receta.category,
          meal_emoji:           receta.emoji,
          estimated_cost:       receta.estimated_cost,
          prep_time_minutes:    receta.prep_time_minutes,
          is_diabetic_friendly: receta.is_diabetic_friendly ?? false,
          is_healthy:           true,
          difficulty:           receta.difficulty,
          ingredients:          receta.ingredients,
          instructions:         receta.instructions,
          chef_tip:             receta.chef_tip,
          tags:                 receta.tags,
          image_url:            imageUrl,
          image_search_query:   buildSearchQuery(receta.name, receta.category),
          generated_by_ai:      true,
          family_id,
        })
        .select()
        .single()

      if (!mealError && meal) {
        savedMeals.push(meal)

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
