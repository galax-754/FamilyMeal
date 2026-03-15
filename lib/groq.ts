import Groq from 'groq-sdk'
import { GROQ_API_KEY } from '@/config'

const groq = new Groq({ apiKey: GROQ_API_KEY })

export interface MealSuggestion {
  name: string
  description: string
  category: 'desayuno' | 'comida' | 'cena' | 'snack'
  prep_time_minutes: number
  ingredients: Array<{ name: string; quantity: string; unit: string }>
}

export async function suggestMeals(
  existingMeals: string[],
  preferences: string = ''
): Promise<MealSuggestion[]> {
  const existing = existingMeals.slice(0, 20).join(', ')

  const completion = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [
      {
        role: 'system',
        content: `Eres un chef mexicano experto en comida familiar. 
Sugieres platillos nutritivos, deliciosos y fáciles de preparar.
Responde SOLO con un array JSON válido, sin markdown ni texto adicional.`,
      },
      {
        role: 'user',
        content: `Sugiere 5 platillos diferentes que no estén en esta lista: [${existing}].
${preferences ? `Preferencias: ${preferences}` : ''}
Formato:
[
  {
    "name": "nombre",
    "description": "descripción breve",
    "category": "desayuno|comida|cena|snack",
    "prep_time_minutes": número,
    "ingredients": [{ "name": "nombre", "quantity": "cantidad", "unit": "unidad" }]
  }
]`,
      },
    ],
    temperature: 0.8,
    max_tokens: 2048,
  })

  const text = completion.choices[0]?.message?.content ?? '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as MealSuggestion[]
}
