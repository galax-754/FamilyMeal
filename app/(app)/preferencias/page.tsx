'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Activity, Leaf } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { getWeekNumber } from '@/lib/votes'

interface FormState {
  is_diabetic: boolean
  is_vegetarian: boolean
  avoid_foods: string[]
  preferred_categories: string[]
  max_prep_time: number
  notes: string
}

const AVOID_OPTIONS = [
  { id: 'mariscos', label: 'Mariscos' },
  { id: 'gluten',   label: 'Gluten'   },
  { id: 'lacteos',  label: 'Lácteos'  },
  { id: 'picante',  label: 'Picante'  },
  { id: 'cerdo',    label: 'Cerdo'    },
  { id: 'res',      label: 'Res'      },
]

const PREP_TIMES = [
  { value: 20,  label: '20 min',  desc: 'Rápido' },
  { value: 40,  label: '40 min',  desc: 'Normal' },
  { value: 60,  label: '1 hora',  desc: 'Con tiempo' },
  { value: 120, label: '2+ hrs',  desc: 'Sin límite' },
]

export default function PreferenciasPage() {
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    is_diabetic: false,
    is_vegetarian: false,
    avoid_foods: [],
    preferred_categories: ['desayuno', 'comida', 'cena'],
    max_prep_time: 60,
    notes: '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (prof?.family_id) setFamilyId(prof.family_id)

      // Intentar cargar preferencias existentes de esta semana
      try {
        const semana = getWeekNumber(new Date())
        const anio = new Date().getFullYear()
        const { data: existing } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('profile_id', user.id)
          .eq('week_number', semana)
          .eq('year', anio)
          .maybeSingle()

        if (existing) {
          setForm({
            is_diabetic: existing.is_diabetic ?? false,
            is_vegetarian: existing.is_vegetarian ?? false,
            avoid_foods: existing.avoid_foods ?? [],
            preferred_categories: existing.preferred_categories ?? ['desayuno', 'comida', 'cena'],
            max_prep_time: existing.max_prep_time ?? 60,
            notes: existing.notes ?? '',
          })
        }
      } catch {
        // tabla puede no existir todavía
      }

      setLoading(false)
    }
    init()
  }, [])

  const toggleAvoid = (id: string) => {
    setForm((prev) => ({
      ...prev,
      avoid_foods: prev.avoid_foods.includes(id)
        ? prev.avoid_foods.filter((f) => f !== id)
        : [...prev.avoid_foods, id],
    }))
  }

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      preferred_categories: prev.preferred_categories.includes(cat)
        ? prev.preferred_categories.filter((c) => c !== cat)
        : [...prev.preferred_categories, cat],
    }))
  }

  const handleSave = async () => {
    if (!userId || !familyId) return
    setSaving(true)
    try {
      const semana = getWeekNumber(new Date())
      const anio = new Date().getFullYear()

      await supabase
        .from('user_preferences')
        .upsert(
          {
            profile_id: userId,
            family_id: familyId,
            week_number: semana,
            year: anio,
            ...form,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id,week_number,year' }
        )

      toast.success('¡Preferencias guardadas!')
      router.push('/inicio')
    } catch (err) {
      console.error(err)
      toast.error('No se pudieron guardar las preferencias.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Mis preferencias" />
        <div className="page-content stack-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Mis preferencias" subtitle="Esta semana" />

      <div className="page-content-spacious stack-6">
        {/* ── DIETA ──────────────────────────────────────── */}
        <section>
          <h3 className="section-title mb-12">Dieta especial</h3>
          <div className="card stack-3">
            {[
              { key: 'is_diabetic' as const,   label: 'Soy diabético/a',   Icon: Activity },
              { key: 'is_vegetarian' as const, label: 'Soy vegetariano/a', Icon: Leaf },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setForm((prev) => ({ ...prev, [key]: !prev[key] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
                  <Icon style={{ width: 20, height: 20, color: 'var(--muted)' }} />
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
                <div
                  style={{
                    width: 22, height: 22,
                    borderRadius: '50%',
                    border: form[key] ? 'none' : '2px solid var(--border-med)',
                    background: form[key] ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                  }}
                >
                  {form[key] && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── ALIMENTOS A EVITAR ─────────────────────────── */}
        <section>
          <h3 className="section-title mb-12">Alimentos que evito</h3>
          <div className="pref-option-grid">
            {AVOID_OPTIONS.map(({ id, label }) => {
              const selected = form.avoid_foods.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleAvoid(id)}
                  className={`pref-option-btn${selected ? ' selected' : ''}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── TIPOS DE COMIDA ────────────────────────────── */}
        <section>
          <h3 className="section-title mb-12">¿Qué comidas quieres en el menú?</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'desayuno', label: 'Desayuno', emoji: '🌅' },
              { id: 'comida',   label: 'Comida',   emoji: '☀️' },
              { id: 'cena',     label: 'Cena',     emoji: '🌙' },
            ].map(({ id, label, emoji }) => {
              const selected = form.preferred_categories.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  className={`pref-option-btn${selected ? ' selected' : ''}`}
                  style={{ flex: 1 }}
                >
                  <span className="pref-option-emoji">{emoji}</span>
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── TIEMPO DE PREPARACIÓN ─────────────────────── */}
        <section>
          <h3 className="section-title mb-12">Tiempo máximo de preparación</h3>
          <div className="pref-option-grid">
            {PREP_TIMES.map(({ value, label, desc }) => {
              const selected = form.max_prep_time === value
              return (
                <button
                  key={value}
                  onClick={() => setForm((prev) => ({ ...prev, max_prep_time: value }))}
                  className={`pref-option-btn${selected ? ' selected' : ''}`}
                >
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{label}</span>
                  <span style={{ fontSize: 11, color: selected ? 'var(--amber)' : 'var(--muted)' }}>{desc}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── NOTAS ─────────────────────────────────────── */}
        <section>
          <h3 className="section-title mb-12">Notas adicionales (opcional)</h3>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Ej. No me gustan los tacos de canasta, prefiero algo ligero los lunes..."
            className="input"
            rows={3}
            style={{ resize: 'none', lineHeight: 1.5 }}
          />
        </section>

        <Button
          fullWidth
          onClick={handleSave}
          loading={saving}
          icon={<ChevronRight style={{ width: 18, height: 18 }} />}
        >
          Guardar preferencias
        </Button>
      </div>
    </div>
  )
}
