'use client'

import { useState } from 'react'
import { Plus, Trash2, Sunrise, Sun, Moon, Apple, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from './ImageUpload'
import { Meal, Ingredient, MealCategory } from '@/types'

export interface MealFormData {
  name: string
  description: string
  category: MealCategory
  prep_time_minutes: string
  image_base64: string | null
  image_media_type: string | null
  image_url: string | null
  analyzed_by_ai: boolean
  ai_description: string
  ingredients: Array<{ name: string; quantity: string; unit: string }>
}

interface MealFormProps {
  initialData?: Partial<MealFormData>
  onSubmit: (data: MealFormData) => Promise<void>
  onAnalyze?: (base64: string, mediaType: string) => Promise<void>
  analyzing?: boolean
  loading?: boolean
  submitLabel?: string
}

const CATEGORIES: Array<{ value: MealCategory; label: string; Icon: LucideIcon }> = [
  { value: 'desayuno', label: 'Desayuno', Icon: Sunrise },
  { value: 'comida',   label: 'Comida',   Icon: Sun },
  { value: 'cena',     label: 'Cena',     Icon: Moon },
  { value: 'snack',    label: 'Snack',    Icon: Apple },
]

export function MealForm({
  initialData,
  onSubmit,
  onAnalyze,
  analyzing,
  loading,
  submitLabel = 'Guardar comida',
}: MealFormProps) {
  const [form, setForm] = useState<MealFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    category: initialData?.category ?? 'comida',
    prep_time_minutes: initialData?.prep_time_minutes ?? '',
    image_base64: initialData?.image_base64 ?? null,
    image_media_type: initialData?.image_media_type ?? null,
    image_url: initialData?.image_url ?? null,
    analyzed_by_ai: initialData?.analyzed_by_ai ?? false,
    ai_description: initialData?.ai_description ?? '',
    ingredients: initialData?.ingredients ?? [{ name: '', quantity: '', unit: '' }],
  })

  const update = (key: keyof MealFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const updateIngredient = (i: number, key: string, value: string) => {
    const ing = [...form.ingredients]
    ing[i] = { ...ing[i], [key]: value }
    update('ingredients', ing)
  }

  const addIngredient = () =>
    update('ingredients', [...form.ingredients, { name: '', quantity: '', unit: '' }])

  const removeIngredient = (i: number) =>
    update('ingredients', form.ingredients.filter((_, idx) => idx !== i))

  const handleImageChange = (url: string | null, base64: string | null, mediaType: string | null) => {
    update('image_url', url)
    update('image_base64', base64)
    update('image_media_type', mediaType)
  }

  const handleAnalyze = async (base64: string, mediaType: string) => {
    if (!onAnalyze) return
    await onAnalyze(base64, mediaType)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <div className="form-field">
        <label className="form-label">Foto del platillo</label>
        <ImageUpload
          value={form.image_url}
          base64Value={form.image_base64}
          onChange={handleImageChange}
          onAnalyze={onAnalyze ? handleAnalyze : undefined}
          analyzing={analyzing}
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          Nombre del platillo <span className="form-required">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Ej. Tacos de pastor"
          required
          className="input"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Breve descripción del platillo..."
          rows={3}
          className="input textarea"
        />
      </div>

      {form.ai_description && (
        <div className="ai-box">
          <p className="ai-box-title"><Sparkles style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />Análisis de IA</p>
          <p className="ai-box-text">{form.ai_description}</p>
        </div>
      )}

      <div className="form-field">
        <label className="form-label">Tipo de comida</label>
        <div className="category-grid">
          {CATEGORIES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => update('category', value)}
              className={`category-btn${form.category === value ? ' active' : ''}`}
            >
              <Icon className="category-btn-emoji" style={{ width: 18, height: 18 }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Tiempo de preparación (minutos)</label>
        <input
          type="number"
          value={form.prep_time_minutes}
          onChange={(e) => update('prep_time_minutes', e.target.value)}
          placeholder="Ej. 30"
          min="1"
          max="480"
          className="input"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Ingredientes</label>
        <div className="stack-2">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="ingredient-row">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                placeholder="Ingrediente"
                className="input"
              />
              <input
                type="text"
                value={ing.quantity}
                onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                placeholder="Cant."
                className="input input-small"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                placeholder="Unidad"
                className="input input-medium"
              />
              {form.ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="btn-icon-danger"
                >
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addIngredient} className="add-btn-text">
          <Plus style={{ width: 16, height: 16 }} />
          Agregar ingrediente
        </button>
      </div>

      <Button type="submit" fullWidth loading={loading}>
        {submitLabel}
      </Button>
    </form>
  )
}
