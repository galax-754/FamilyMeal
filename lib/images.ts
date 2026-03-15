const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID

const FOOD_TRANSLATIONS: Record<string, string> = {
  'chilaquiles': 'chilaquiles verdes mexicanos',
  'tacos': 'tacos mexicanos caseros',
  'sopa': 'sopa mexicana casera',
  'arroz': 'arroz rojo mexicano',
  'pollo': 'pollo guisado mexicano',
  'pescado': 'tacos de pescado',
  'enchiladas': 'enchiladas verdes mexicanas',
  'pozole': 'pozole rojo mexicano',
  'nopales': 'nopales con huevo mexicano',
  'frijoles': 'frijoles negros mexicanos',
  'huevo': 'huevos rancheros mexicanos',
  'caldo': 'caldo de pollo mexicano',
  'res': 'carne de res guisada mexicana',
  'cerdo': 'carnitas mexicanas',
  'tamales': 'tamales mexicanos',
  'quesadilla': 'quesadillas mexicanas',
  'flautas': 'flautas mexicanas',
  'mole': 'mole con pollo mexicano',
  'empanizado': 'filete empanizado crujiente',
  'ensalada': 'ensalada fresca saludable',
  'lentejas': 'sopa de lentejas mexicana',
  'calabaza': 'calabaza guisada mexicana',
  'milanesa': 'milanesa de res mexicana',
  'bistek': 'bistek a la mexicana',
  'gorditas': 'gorditas mexicanas',
  'avena': 'avena con frutas desayuno',
  'omelette': 'omelette desayuno saludable',
}

export function buildSearchQuery(
  mealName: string,
  category: string
): string {
  const nameLower = mealName.toLowerCase()

  for (const [spanish, query] of Object.entries(FOOD_TRANSLATIONS)) {
    if (nameLower.includes(spanish)) {
      return `${query} platillo comida`
    }
  }

  return `${mealName} comida mexicana casera platillo`
}

export async function searchFoodImage(
  mealName: string,
  category: string
): Promise<string | null> {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('Google Search keys no configuradas')
    return getFallbackImage(category)
  }

  try {
    const query = buildSearchQuery(mealName, category)
    const encodedQuery = encodeURIComponent(query)

    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${GOOGLE_API_KEY}` +
      `&cx=${GOOGLE_SEARCH_ENGINE_ID}` +
      `&q=${encodedQuery}` +
      `&searchType=image` +
      `&num=5` +
      `&imgSize=large` +
      `&imgType=photo` +
      `&safe=active`

    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24 horas
    })

    if (!res.ok) {
      console.error('Google Search error:', res.status)
      return getFallbackImage(category)
    }

    const data = await res.json()

    if (!data.items || data.items.length === 0) {
      console.log('Sin resultados para:', query)
      return getFallbackImage(category)
    }

    // Priorizar resultados de blogs de recetas
    const foodSites = [
      'kiwilimon', 'recetas', 'cocina', 'food',
      'comida', 'gastro', 'chef', 'platillo',
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bestResult = data.items.find((item: any) =>
      foodSites.some(
        (site) =>
          item.displayLink?.toLowerCase().includes(site) ||
          item.title?.toLowerCase().includes(site)
      )
    ) || data.items[0]

    return bestResult.link as string
  } catch (error) {
    console.error('Error buscando imagen:', error)
    return getFallbackImage(category)
  }
}

function getFallbackImage(category: string): string {
  const fallbacks: Record<string, string> = {
    Desayuno: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    desayuno: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    Comida:   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    comida:   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    Cena:     'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    cena:     'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  }
  return fallbacks[category] ?? fallbacks['comida']
}
