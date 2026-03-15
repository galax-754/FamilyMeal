import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — buscar ingredientes en el catálogo
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  let dbQuery = supabase
    .from('ingredient_catalog')
    .select('id, name, category, unit, price_mxn')
    .order('name')
    .limit(20)

  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`)
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }

  const { data, error } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ingredients: data || [] })
}

// POST — agregar nuevo ingrediente al catálogo si no existe
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { name, category, unit, price_mxn } = await req.json()

  const { data, error } = await supabase
    .from('ingredient_catalog')
    .insert({
      name,
      category: category || 'Otros',
      unit: unit || 'pieza',
      price_mxn: price_mxn || 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ingredient: data })
}
