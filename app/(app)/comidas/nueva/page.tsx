'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { MealForm, MealFormData } from '@/components/meals/MealForm'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

export default function NuevaComidaPage() {
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [formData, setFormData] = useState<Partial<MealFormData>>({})
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  const handleAnalyze = async (base64: string, mediaType: string) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analizar-imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })

      if (!res.ok) throw new Error('Error al analizar')
      const analysis = await res.json()

      setFormData({
        name: analysis.name ?? '',
        description: analysis.description ?? '',
        category: analysis.category ?? 'comida',
        prep_time_minutes: analysis.prep_time_minutes?.toString() ?? '',
        ai_description: analysis.tips ?? '',
        analyzed_by_ai: true,
        image_base64: base64,
        image_media_type: mediaType,
        ingredients: analysis.ingredients?.map((i: { name: string; quantity: string; unit: string }) => ({
          name: i.name,
          quantity: i.quantity ?? '',
          unit: i.unit ?? '',
        })) ?? [{ name: '', quantity: '', unit: '' }],
      })

      toast.success('Imagen analizada con IA correctamente.')
    } catch {
      toast.error('No se pudo analizar la imagen. Intenta de nuevo.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = async (data: MealFormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sesión expirada. Inicia sesión de nuevo.'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (!prof?.family_id) { toast.error('Primero únete a una familia.'); return }

      let imageUrl: string | null = null
      if (data.image_base64) {
        const ext = data.image_media_type?.split('/')[1] ?? 'jpg'
        const path = `${prof.family_id}/${Date.now()}.${ext}`
        const bytes = Uint8Array.from(atob(data.image_base64), (c) => c.charCodeAt(0))

        const { error: uploadErr } = await supabase.storage
          .from('meal-images')
          .upload(path, bytes, { contentType: data.image_media_type ?? 'image/jpeg' })

        if (!uploadErr) {
          const { data: pub } = supabase.storage.from('meal-images').getPublicUrl(path)
          imageUrl = pub.publicUrl
        }
      }

      const { data: meal, error: mealErr } = await supabase
        .from('meals')
        .insert({
          family_id: prof.family_id,
          name: data.name,
          description: data.description || null,
          category: data.category,
          prep_time_minutes: data.prep_time_minutes ? parseInt(data.prep_time_minutes) : null,
          image_url: imageUrl,
          image_base64: data.image_base64 ?? null,
          analyzed_by_ai: data.analyzed_by_ai,
          ai_description: data.ai_description || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (mealErr) throw mealErr

      const validIngredients = data.ingredients.filter((i) => i.name.trim())
      if (validIngredients.length > 0) {
        await supabase.from('ingredients').insert(
          validIngredients.map((i) => ({
            meal_id: meal.id,
            name: i.name.trim(),
            quantity: i.quantity || null,
            unit: i.unit || null,
          }))
        )
      }

      toast.success(`"${meal.name}" guardada correctamente.`)
      router.push('/comidas')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Nueva comida" back />
      <div className="page-content mt-8">
        <MealForm
          initialData={formData}
          onSubmit={handleSubmit}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          loading={loading}
          submitLabel="Guardar comida"
        />
      </div>
    </div>
  )
}
