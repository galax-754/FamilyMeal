import { NextRequest, NextResponse } from 'next/server'
import { analyzeMealImage } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const { image, mediaType } = await request.json()

    if (!image) {
      return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 })
    }

    const analysis = await analyzeMealImage(image, mediaType ?? 'image/jpeg')
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error al analizar imagen con Claude:', error)
    return NextResponse.json(
      { error: 'Algo salió mal al analizar la imagen. Intenta de nuevo 🔄' },
      { status: 500 }
    )
  }
}
