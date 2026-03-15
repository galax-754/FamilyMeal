import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Cliente admin — usa service_role key para poder escribir en Storage
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars no configuradas')
  return createClient(url, key)
}

export async function uploadImageToStorage(
  imageUrl: string,
  mealId: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`No se pudo descargar imagen: ${res.status}`)

    const buffer  = await res.arrayBuffer()
    const uint8   = new Uint8Array(buffer)
    const fileName = `meals/${mealId}-${Date.now()}.png`

    const supabaseAdmin = getSupabaseAdmin()

    const { error } = await supabaseAdmin
      .storage
      .from('meal-images')
      .upload(fileName, uint8, { contentType: 'image/png', upsert: true })

    if (error) {
      console.error('Error subiendo a Storage:', error.message)
      return null
    }

    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('meal-images')
      .getPublicUrl(fileName)

    console.log('✅ Imagen guardada en Storage:', publicUrlData.publicUrl)
    return publicUrlData.publicUrl
  } catch (err) {
    console.error('Error en uploadImageToStorage:', err)
    return null
  }
}

const FOOD_TRANSLATIONS: Record<string, string> = {
  chilaquiles:  'chilaquiles verdes mexican breakfast',
  omelette:     'fluffy omelette with vegetables',
  pechuga:      'grilled chicken breast',
  pollo:        'chicken dish',
  rellena:      'stuffed chicken',
  tacos:        'mexican tacos',
  sopa:         'homemade soup',
  arroz:        'rice dish',
  ensalada:     'fresh salad bowl',
  pasta:        'italian pasta dish',
  salmon:       'salmon fillet',
  camarones:    'shrimp dish',
  carne:        'beef steak',
  res:          'beef dish',
  frijoles:     'black beans mexican',
  quesadilla:   'mexican quesadilla',
  enchiladas:   'mexican enchiladas',
  nopales:      'mexican cactus food',
  huevo:        'eggs breakfast',
  avena:        'oatmeal breakfast bowl',
  champiñones:  'mushroom dish',
  pozole:       'mexican pozole soup',
  milanesa:     'breaded meat cutlet',
  bistek:       'beef steak mexican style',
  lentejas:     'lentil soup bowl',
  sardinas:     'sardine dish',
  atun:         'tuna dish',
}

const CATEGORY_CONTEXT: Record<string, string> = {
  Desayuno: 'breakfast plate, morning light',
  Comida:   'lunch plate, natural light',
  Cena:     'dinner plate, warm evening light',
}

function buildImagePrompt(mealName: string, category: string): string {
  const lower = mealName.toLowerCase()
  let translatedName = lower

  for (const [es, en] of Object.entries(FOOD_TRANSLATIONS)) {
    if (lower.includes(es)) {
      translatedName = en
      break
    }
  }

  const context = CATEGORY_CONTEXT[category] || 'food plate'

  return (
    `Professional food photography of ${translatedName}, ` +
    `${context}, served on a beautiful plate, ` +
    `restaurant quality presentation, ` +
    `appetizing, high resolution, ` +
    `shallow depth of field, warm tones, ` +
    `no text, no watermarks, no people`
  )
}

// Mantener buildSearchQuery para compatibilidad con cualquier importación existente
export function buildSearchQuery(mealName: string, _category: string): string {
  return mealName
}

export async function searchFoodImage(
  mealName: string,
  category: string
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY no configurada — usando imagen de fallback')
    return getFallbackImage(category)
  }

  try {
    const prompt = buildImagePrompt(mealName, category)
    console.log('Generando imagen con DALL-E para:', mealName)

    const response = await openai.images.generate({
      model:   'dall-e-3',
      prompt,
      n:       1,
      size:    '1024x1024',
      quality: 'standard',
    })

    const imageUrl = response.data[0]?.url
    console.log('✅ Imagen generada:', imageUrl ? 'OK' : 'null')
    return imageUrl || getFallbackImage(category)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error DALL-E:', msg)
    return getFallbackImage(category)
  }
}

function getFallbackImage(category: string): string {
  const fallbacks: Record<string, string> = {
    Desayuno: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    Comida:   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    Cena:     'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  }
  return fallbacks[category] ?? fallbacks['Comida']
}
