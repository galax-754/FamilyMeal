export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
})

interface IngredientItem {
  name: string
  quantity: number
  unit: string
}

export async function POST(req: NextRequest) {
  const {
    meal_name,
    category,
    ingredients,
    family_has_diabetic,
  }: {
    meal_name: string
    category: string
    ingredients: IngredientItem[]
    family_has_diabetic?: boolean
  } = await req.json()

  const ingredientList = ingredients
    .map((i) => `${i.quantity} ${i.unit} de ${i.name}`)
    .join(', ')

  const prompt = `Eres un chef mexicano profesional.
Genera una receta detallada para: "${meal_name}" (${category})
Ingredientes disponibles: ${ingredientList}
${family_has_diabetic ? '⚠️ La receta debe ser apta para diabéticos.' : ''}

Responde SOLO con JSON válido sin bloques de código:
{
  "description": "Descripción apetitosa en 2 oraciones",
  "instructions": [
    {"step": 1, "title": "Título del paso", "text": "Instrucción detallada"},
    {"step": 2, "title": "Título del paso", "text": "Instrucción detallada"}
  ],
  "chef_tip": "Un tip profesional que marque la diferencia",
  "prep_time_minutes": 30,
  "difficulty": "fácil",
  "is_diabetic_friendly": true
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    if (!responseText || responseText.trim() === '') {
      console.error('Claude devolvió respuesta vacía en generar-receta-individual')
      return NextResponse.json(
        { error: 'Claude no generó respuesta' },
        { status: 500 }
      )
    }

    let clean = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()

    const firstBrace = clean.indexOf('{')
    const lastBrace = clean.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1) {
      console.error('No se encontró JSON en la respuesta de generar-receta-individual')
      console.error('Respuesta raw (primeros 500 chars):', responseText.substring(0, 500))
      return NextResponse.json(
        { error: 'Error procesando respuesta de IA' },
        { status: 500 }
      )
    }

    clean = clean.substring(firstBrace, lastBrace + 1)
    const recipe = JSON.parse(clean)

    return NextResponse.json({ success: true, recipe })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error generando receta individual:', msg)
    return NextResponse.json(
      { error: 'Error generando receta' },
      { status: 500 }
    )
  }
}
