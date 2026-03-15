import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_API_KEY } from '@/config'

const client = new Anthropic({ apiKey: CLAUDE_API_KEY })

export interface MealAnalysis {
  name: string
  description: string
  category: 'desayuno' | 'comida' | 'cena' | 'snack'
  ingredients: Array<{ name: string; quantity: string; unit: string }>
  prep_time_minutes: number
  tips: string
}

export async function analyzeMealImage(base64Image: string, mediaType: string = 'image/jpeg'): Promise<MealAnalysis> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Analiza esta imagen de comida y responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto adicional):
{
  "name": "nombre del platillo en español",
  "description": "descripción breve y apetitosa en español (máximo 2 oraciones)",
  "category": "desayuno|comida|cena|snack",
  "ingredients": [
    { "name": "ingrediente", "quantity": "cantidad", "unit": "unidad" }
  ],
  "prep_time_minutes": número_entero,
  "tips": "un consejo breve para prepararlo mejor"
}`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as MealAnalysis
}
