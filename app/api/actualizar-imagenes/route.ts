export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchFoodImage } from '@/lib/images'

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
    .select('id, name, category, image_url')
    .eq('family_id', family_id)

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: 'No hay recetas' }, { status: 404 })
  }

  const updated: string[] = []
  const failed: string[] = []

  for (const meal of meals) {
    try {
      console.log('Buscando imagen para:', meal.name)

      const imageUrl = await searchFoodImage(meal.name, meal.category)

      if (imageUrl) {
        await supabase
          .from('meals')
          .update({ image_url: imageUrl })
          .eq('id', meal.id)

        updated.push(meal.name)
        console.log('✅ Imagen actualizada:', meal.name)
      } else {
        failed.push(meal.name)
      }

      // Pausa para no saturar la API de Google
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error('Error con:', meal.name, err)
      failed.push(meal.name)
    }
  }

  return NextResponse.json({
    success: true,
    updated: updated.length,
    failed: failed.length,
    updated_meals: updated,
    failed_meals: failed,
  })
}
