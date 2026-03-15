export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { CLAUDE_API_KEY } from '@/config'

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY })
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generarPromptImagen(meal: any): Promise<string> {
  const ingredientesPrincipales = (meal.ingredients ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .slice(0, 6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => `${i.quantity} ${i.unit} de ${i.name}`)
    .join(', ')

  const promptParaClaude = `Eres un director de fotografía gastronómica profesional.

Genera un prompt en INGLÉS para DALL-E 3 que describa cómo debe verse este platillo en una foto profesional:

PLATILLO: ${meal.name}
DESCRIPCIÓN: ${meal.description || ''}
INGREDIENTES PRINCIPALES: ${ingredientesPrincipales || 'no disponibles'}
CATEGORÍA: ${meal.category}
DIFICULTAD: ${meal.difficulty || 'media'}

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

  return `Professional food photography of ${meal.name}, appetizing, restaurant quality presentation, warm lighting, shallow depth of field, no text, no people`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { family_id } = await req.json()
  if (!family_id) {
    return NextResponse.json({ error: 'family_id requerido' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, family_id')
    .eq('id', user.id)
    .single()

  if (profile?.family_id !== family_id || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el admin puede actualizar imágenes' }, { status: 403 })
  }

  const { data: meals } = await supabase
    .from('meals')
    .select('id, name, category, description, difficulty, ingredients')
    .eq('family_id', family_id)

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: 'No hay recetas' }, { status: 404 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 })
  }

  const updated: string[] = []
  const failed:  string[] = []

  for (const meal of meals) {
    try {
      console.log('Generando imagen para:', meal.name)

      // 1. Claude genera el prompt visual
      const dallePrompt = await generarPromptImagen(meal)

      // 2. DALL-E genera la imagen
      const response = await openai.images.generate({
        model:   'dall-e-3',
        prompt:  dallePrompt,
        n:       1,
        size:    '1024x1024',
        quality: 'standard',
      })

      const imageUrl = response.data[0]?.url
      if (imageUrl) {
        await supabase
          .from('meals')
          .update({
            image_url:          imageUrl,
            image_search_query: dallePrompt.substring(0, 200),
          })
          .eq('id', meal.id)

        updated.push(meal.name)
        console.log('✅ Imagen actualizada:', meal.name)
      } else {
        failed.push(meal.name)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Error con:', meal.name, msg)
      failed.push(meal.name)
    }

    // Pausa entre recetas para no saturar las APIs
    await new Promise((r) => setTimeout(r, 1000))
  }

  return NextResponse.json({
    success:       true,
    updated:       updated.length,
    failed:        failed.length,
    updated_meals: updated,
    failed_meals:  failed,
  })
}
