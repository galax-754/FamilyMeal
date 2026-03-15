export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { searchFoodImage } from '@/lib/images'
import { CLAUDE_API_KEY } from '@/config'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRecetaJSON(text: string): any {
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const firstBrace = clean.indexOf('{')
  const lastBrace  = clean.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No se encontró JSON en la respuesta')
  }

  return JSON.parse(clean.substring(firstBrace, lastBrace + 1))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { family_id }: { family_id: string } = body

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    console.log('Family ID recibido:', family_id)

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

    // Consolidar preferencias de todos los miembros
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

    const likesArray    = Array.from(allLikes)
    const dislikesArray = Array.from(allDislikes)
    const recentMeals   = (existingMeals ?? []).map((m) => m.name)
    const weekNumber    = getWeekNumber(new Date())
    const budgetWeekly  = (familyData?.budget_weekly as number | null) ?? 2500
    const budgetPerMeal = Math.round(budgetWeekly / 21) // 3 comidas × 7 días

    // 3 llamadas separadas — 1 receta por categoría para evitar JSON truncado
    const categorias = ['Desayuno', 'Comida', 'Cena']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todasLasRecetas: any[] = []

    for (const categoria of categorias) {
      const prompt = `Eres chef profesional mexicano con 20 años de experiencia.
Genera EXACTAMENTE 1 receta de ${categoria} para 4 personas.
Alto en proteína (mínimo 30g por porción).
Presupuesto: $${budgetPerMeal} MXN por platillo.
${hasDiabetic ? 'OBLIGATORIO: apta para diabéticos, bajo índice glucémico.' : ''}
Variedad: mexicana, italiana, mediterránea, asiática o americana.
Les gusta: ${likesArray.slice(0, 6).join(', ') || 'variado'}.
Evitar: ${dislikesArray.slice(0, 3).join(', ') || 'nada'}.
Alergias: ${Array.from(allAllergies).join(', ') || 'ninguna'}.
No repetir: ${recentMeals.slice(0, 3).join(', ') || 'nada'}.

ESTILO DE INSTRUCCIONES:
- Usa lenguaje simple y cotidiano, NO términos técnicos ni en francés
- En vez de "sellar la proteína" → "dora el pollo a fuego alto hasta que esté café por fuera"
- En vez de "desglasar" → "agrega el vino y raspa el fondo del sartén con una cuchara"
- En vez de "brunoise" → "pica muy finito en cubitos pequeños"
- En vez de "sofreír" → "cocina en aceite a fuego medio moviendo de vez en cuando"
- Cada paso debe explicar POR QUÉ se hace, no solo el QUÉ. Ejemplo: "Seca bien el pollo con papel (esto hace que dore mejor y no se cueza al vapor)"
- Temperaturas en términos prácticos: "fuego bajo", "fuego medio", "fuego alto" o "horno a 180°C (temperatura normal del horno)"
- Tiempos claros: "unos 3-4 minutos", nunca "reducir a glaze" ni términos ambiguos

RESPONDE SOLO con este JSON sin texto adicional:
{
  "name": "Nombre específico del platillo",
  "description": "2 oraciones apetitosas que hagan agua la boca",
  "category": "${categoria.toLowerCase()}",
  "emoji": "🍳",
  "estimated_cost": ${budgetPerMeal},
  "prep_time_minutes": 30,
  "is_diabetic_friendly": ${hasDiabetic},
  "difficulty": "fácil",
  "ingredients": [
    {"name": "ingrediente", "quantity": 200, "unit": "g", "estimated_price_mxn": 25}
  ],
  "instructions": [
    {"step": 1, "title": "Título técnico", "text": "Instrucción con temperatura y tiempo exacto"}
  ],
  "chef_tip": "Tip técnico específico que mejore el resultado",
  "tags": ["tag1", "tag2"]
}`

      try {
        const message = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages:   [{ role: 'user', content: prompt }],
        })

        const text = message.content[0].type === 'text' ? message.content[0].text : ''
        const receta = parseRecetaJSON(text)
        todasLasRecetas.push(receta)
        console.log('✅ Receta generada:', receta.name)
      } catch (err) {
        console.error(`❌ Error generando receta de ${categoria}:`, err)
        // Continuar con las demás categorías aunque una falle
      }
    }

    console.log('Recetas generadas por Claude:', todasLasRecetas.length)

    if (todasLasRecetas.length === 0) {
      return NextResponse.json({ error: 'No se pudieron generar recetas' }, { status: 500 })
    }

    // Buscar imágenes en paralelo
    const images = await Promise.all(
      todasLasRecetas.map((r) => searchFoodImage(r.name, r.category))
    )

    // Normalizar categorías al formato que acepta el CHECK constraint de la BD
    const categoryMap: Record<string, string> = {
      desayuno:  'Desayuno',
      comida:    'Comida',
      cena:      'Cena',
      snack:     'Snack',
      almuerzo:  'Comida',
      lunch:     'Comida',
      dinner:    'Cena',
      breakfast: 'Desayuno',
      Desayuno:  'Desayuno',
      Comida:    'Comida',
      Cena:      'Cena',
      Snack:     'Snack',
    }

    const savedMeals = []

    for (let i = 0; i < todasLasRecetas.length; i++) {
      const receta   = todasLasRecetas[i]
      const imageUrl = images[i]

      const normalizedCategory =
        categoryMap[receta.category] ||
        categoryMap[receta.category?.toLowerCase()] ||
        'Comida'

      console.log('Categoría original:', receta.category)
      console.log('Categoría normalizada:', normalizedCategory)

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          name:                 receta.name,
          description:          receta.description,
          category:             normalizedCategory,
          meal_emoji:           receta.emoji            || '🍽️',
          estimated_cost:       receta.estimated_cost   || 0,
          prep_time_minutes:    receta.prep_time_minutes || 30,
          is_diabetic_friendly: receta.is_diabetic_friendly ?? false,
          is_healthy:           true,
          difficulty:           receta.difficulty       || 'fácil',
          ingredients:          receta.ingredients      || [],
          instructions:         receta.instructions     || [],
          chef_tip:             receta.chef_tip         || '',
          tags:                 receta.tags             || [],
          image_url:            imageUrl                || null,
          generated_by_ai:      true,
          family_id,
        })
        .select()
        .single()

      console.log('Insert result:', meal?.id, 'Error:', JSON.stringify(mealError))

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
