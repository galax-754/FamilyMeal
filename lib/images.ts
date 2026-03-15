const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY

// Traducciones de comida mexicana → inglés para mejor búsqueda en Unsplash
const FOOD_TRANSLATIONS: Record<string, string> = {
  'nopales': 'mexican cactus salad',
  'pozole': 'mexican pozole soup',
  'enchiladas': 'mexican enchiladas',
  'tamales': 'mexican tamales',
  'chilaquiles': 'mexican chilaquiles',
  'tlalpeño': 'mexican chicken soup',
  'lentejas': 'lentil soup',
  'frijoles': 'mexican black beans tacos',
  'avena': 'oatmeal with fruit breakfast',
  'omelette': 'omelette spinach healthy',
  'pollo': 'grilled chicken herbs',
  'salmón': 'salmon fillet healthy',
  'tilapia': 'tilapia fish healthy',
  'atún': 'tuna stuffed pepper',
  'ensalada': 'chicken salad spinach',
  'champiñones': 'chicken mushrooms pan',
  'caldo': 'mexican chicken broth soup',
  'chile relleno': 'stuffed poblano pepper',
  'tacos': 'mexican tacos healthy',
  'sopa': 'homemade soup healthy',
}

export function buildSearchQuery(mealName: string, category: string): string {
  const nameLower = mealName.toLowerCase()

  for (const [spanish, english] of Object.entries(FOOD_TRANSLATIONS)) {
    if (nameLower.includes(spanish)) {
      return `${english} food photography`
    }
  }

  const categoryMap: Record<string, string> = {
    'desayuno': 'breakfast',
    'comida': 'lunch dinner',
    'cena': 'dinner',
    'snack': 'snack',
    // mayúsculas por si acaso
    'Desayuno': 'breakfast',
    'Comida': 'lunch dinner',
    'Cena': 'dinner',
  }

  const categoryEn = categoryMap[category] || 'food'
  return `${mealName} mexican food ${categoryEn} photography`
}

export async function searchFoodImage(
  mealName: string,
  category: string
): Promise<string | null> {
  if (!UNSPLASH_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY no configurada, usando imagen de respaldo')
    return getFallbackImage(category)
  }

  try {
    const query = buildSearchQuery(mealName, category)
    const encodedQuery = encodeURIComponent(query)

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=5&orientation=landscape&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_KEY}`,
        },
        next: { revalidate: 86400 }, // cache 24h para no agotar quota
      }
    )

    if (!res.ok) {
      console.error('Error Unsplash:', res.status, res.statusText)
      return getFallbackImage(category)
    }

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return getFallbackImage(category)
    }

    // Usar la primera foto — tamaño regular (1080px), buen balance calidad/velocidad
    return data.results[0].urls.regular as string
  } catch (error) {
    console.error('Error buscando imagen en Unsplash:', error)
    return getFallbackImage(category)
  }
}

function getFallbackImage(category: string): string {
  const fallbacks: Record<string, string> = {
    'desayuno': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'Desayuno': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'comida': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'Comida': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'cena': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    'Cena': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  }
  return fallbacks[category] ?? fallbacks['comida']
}
