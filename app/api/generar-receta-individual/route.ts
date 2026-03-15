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
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text : ''

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const recipe = JSON.parse(clean)

    return NextResponse.json({ success: true, recipe })
  } catch {
    return NextResponse.json(
      { error: 'Error generando receta' },
      { status: 500 }
    )
  }
}
