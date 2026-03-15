import { NextRequest, NextResponse } from 'next/server'
import { suggestMeals } from '@/lib/groq'

export async function POST(request: NextRequest) {
  try {
    const { existingMeals = [], preferences = '' } = await request.json()

    const suggestions = await suggestMeals(existingMeals, preferences)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error al obtener sugerencias con Groq:', error)
    return NextResponse.json(
      { error: 'Algo salió mal al pedir sugerencias. Intenta de nuevo 🔄' },
      { status: 500 }
    )
  }
}
