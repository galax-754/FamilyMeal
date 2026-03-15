export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { CLAUDE_API_KEY } from '@/config'
import { uploadImageToStorage } from '@/lib/images'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generarPromptImagen(receta: any): Promise<string> {
  const ingredientesPrincipales = (receta.ingredients ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .slice(0, 6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => `${i.quantity} ${i.unit} de ${i.name}`)
    .join(', ')

  const promptParaClaude = `Eres un director de fotografía gastronómica profesional.

Genera un prompt en INGLÉS para DALL-E 3 que describa cómo debe verse este platillo en una foto profesional:

PLATILLO: ${receta.name}
DESCRIPCIÓN: ${receta.description}
INGREDIENTES PRINCIPALES: ${ingredientesPrincipales}
CATEGORÍA: ${receta.category}
DIFICULTAD: ${receta.difficulty}

El prompt debe describir:
- Cómo se ve el platillo terminado y emplatado
- Los colores y texturas visibles
- El tipo de plato o bowl donde se sirve
- La presentación y garnish
- La iluminación y ambiente según la categoría:
  Desayuno=luz matutina natural, Comida=luz de mediodía, Cena=luz cálida de noche
- Estilo: food photography profesional, apetitoso, sin personas, sin texto

Responde SOLO con el prompt en inglés, máximo 200 palabras. Sin explicaciones, sin comillas.`

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: promptParaClaude }],
    })

    const prompt = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    if (prompt) {
      console.log('Prompt DALL-E generado:', prompt.substring(0, 100))
      return prompt
    }
  } catch (err) {
    console.error('Error generando prompt con Claude:', err)
  }

  return `Professional food photography of ${receta.name}, appetizing, restaurant quality presentation, warm lighting, shallow depth of field, no text, no people`
}

const VALID_CATEGORIES = ['Desayuno', 'Comida', 'Cena'] as const
type Categoria = typeof VALID_CATEGORIES[number]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { family_id, categoria }: { family_id: string; categoria?: string } = body

    if (!family_id) {
      return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
    }

    // Si no se especifica categoría, elegir una al azar
    const categoriaTarget: Categoria = (
      VALID_CATEGORIES.includes(categoria as Categoria)
        ? categoria
        : VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)]
    ) as Categoria

    console.log('Family ID recibido:', family_id, '| Categoría:', categoriaTarget)

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

    // Generar 1 receta para la categoría solicitada
    const prompt = `Eres chef profesional mexicano con 20 años de experiencia.
Genera EXACTAMENTE 1 receta de ${categoriaTarget} para 4 personas.
Alto en proteína (mínimo 30g por porción).
Presupuesto: $${budgetPerMeal} MXN por platillo.
${hasDiabetic ? 'OBLIGATORIO: apta para diabéticos, bajo índice glucémico.' : ''}
Variedad: mexicana, italiana, mediterránea, asiática o americana.
Les gusta: ${likesArray.slice(0, 6).join(', ') || 'variado'}.
Evitar: ${dislikesArray.slice(0, 3).join(', ') || 'nada'}.
Alergias: ${Array.from(allAllergies).join(', ') || 'ninguna'}.
No repetir: ${recentMeals.slice(0, 3).join(', ') || 'nada'}.

EQUIPAMIENTO DISPONIBLE (MUY IMPORTANTE):
- Estufa de gas con quemadores
- Sartén antiadherente
- Olla grande y olla mediana
- Comal
- Licuadora
- NO tienen horno en casa
Todas las recetas DEBEN poder cocinarse solo en estufa.
Cualquier paso que mencione "horno", "hornear", "gratinar", "precalentar" o "bandeja al horno" está ESTRICTAMENTE PROHIBIDO.
En vez de técnicas de horno usar:
- Sellar en sartén a fuego alto
- Cocinar tapado a fuego bajo
- Dorar en comal
- Vaporear en olla

ESTILO DE INSTRUCCIONES:
- Usa lenguaje simple y cotidiano, NO términos técnicos ni en francés
- En vez de "sellar la proteína" → "dora el pollo a fuego alto hasta que esté café por fuera"
- En vez de "desglasar" → "agrega el vino y raspa el fondo del sartén con una cuchara"
- En vez de "brunoise" → "pica muy finito en cubitos pequeños"
- En vez de "sofreír" → "cocina en aceite a fuego medio moviendo de vez en cuando"
- Cada paso debe explicar POR QUÉ se hace, no solo el QUÉ. Ejemplo: "Seca bien el pollo con papel (esto hace que dore mejor y no se cueza al vapor)"
- Temperaturas en términos prácticos: "fuego bajo", "fuego medio", "fuego alto"
- NUNCA mencionar "horno" en ningún paso, ni como alternativa
- Tiempos claros: "unos 3-4 minutos", nunca "reducir a glaze" ni términos ambiguos

RESPONDE SOLO con este JSON sin texto adicional:
{
  "name": "Nombre específico del platillo",
  "description": "2 oraciones apetitosas que hagan agua la boca",
  "category": "${categoriaTarget.toLowerCase()}",
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

    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text   = message.content[0].type === 'text' ? message.content[0].text : ''
    const receta = parseRecetaJSON(text)
    console.log('✅ Receta generada:', receta.name)

    // Normalizar categoría al formato que acepta el CHECK constraint de la BD
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

    const normalizedCategory =
      categoryMap[receta.category] ||
      categoryMap[receta.category?.toLowerCase()] ||
      categoriaTarget

    // 1. Claude genera el prompt visual para DALL-E
    const dallePrompt = await generarPromptImagen(receta)

    // 2. Insertar receta sin imagen para obtener el ID real
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
        image_url:            null,
        image_search_query:   dallePrompt.substring(0, 200),
        generated_by_ai:      true,
        family_id,
      })
      .select()
      .single()

    console.log('Insert result:', meal?.id, 'Error:', JSON.stringify(mealError))

    if (mealError || !meal) {
      return NextResponse.json({ error: 'Error al guardar receta: ' + mealError?.message }, { status: 500 })
    }

    // 3. DALL-E genera la imagen y se sube a Storage con URL permanente
    if (process.env.OPENAI_API_KEY) {
      try {
        const dalleResponse = await openai.images.generate({
          model:   'dall-e-3',
          prompt:  dallePrompt,
          n:       1,
          size:    '1024x1024',
          quality: 'standard',
        })
        const tempUrl = dalleResponse.data[0]?.url
        console.log('✅ Imagen DALL-E generada para:', receta.name)

        if (tempUrl) {
          const permanentUrl = await uploadImageToStorage(tempUrl, meal.id)
          const finalUrl = permanentUrl || tempUrl

          await supabase
            .from('meals')
            .update({ image_url: finalUrl })
            .eq('id', meal.id)

          meal.image_url = finalUrl
        }
      } catch (imgError: unknown) {
        const msg = imgError instanceof Error ? imgError.message : String(imgError)
        console.error('Error DALL-E / Storage:', msg)
      }
    } else {
      console.warn('OPENAI_API_KEY no configurada — sin imagen')
    }

    // Historial + estado de votación
    const year = new Date().getFullYear()
    await Promise.all([
      supabase.from('generated_meals_history').insert({
        family_id,
        meal_name:   receta.name,
        week_number: weekNumber,
        year,
      }).then(() => null).catch(() => null),
      supabase.from('weekly_voting_status').upsert(
        {
          family_id,
          week_number:          weekNumber,
          year,
          recipes_generated:    true,
          recipes_generated_at: new Date().toISOString(),
          voting_started:       true,
        },
        { onConflict: 'family_id,week_number,year' }
      ).then(() => null).catch(() => null),
    ])

    return NextResponse.json({ success: true, meal })
  } catch (error) {
    console.error('Error en generar-recetas:', error)
    return NextResponse.json(
      { error: 'Error al generar recetas. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
