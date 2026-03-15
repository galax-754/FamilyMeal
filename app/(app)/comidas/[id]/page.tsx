'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Ingredient {
  name: string
  quantity: number
  unit: string
  estimated_price_mxn?: number
}

interface Instruction {
  step: number
  title: string
  text: string
}

interface Meal {
  id: string
  name: string
  description?: string
  category: string
  meal_emoji?: string
  image_url?: string
  estimated_cost?: number
  prep_time_minutes?: number
  is_diabetic_friendly?: boolean
  difficulty?: string
  ingredients?: Ingredient[]
  instructions?: Instruction[]
  chef_tip?: string
}

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [meal, setMeal] = useState<Meal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMeal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadMeal() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      setLoading(false)
      return
    }
    setMeal(data as Meal)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="skeleton" style={{ height: '300px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '200px' }} />
      </div>
    )
  }

  if (!meal) {
    return (
      <div
        className="page-wrapper"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>🍽️</div>
        <h2 style={{ color: 'var(--text)', marginBottom: '8px' }}>Receta no encontrada</h2>
        <button className="btn-ghost" onClick={() => router.back()}>
          ← Volver
        </button>
      </div>
    )
  }

  const instructions = Array.isArray(meal.instructions) ? meal.instructions : []
  const ingredients  = Array.isArray(meal.ingredients)  ? meal.ingredients  : []

  return (
    <div style={{ paddingBottom: '40px' }}>

      {/* Imagen hero */}
      <div style={{
        width: '100%', height: '260px',
        position: 'relative', background: 'var(--surface2)',
      }}>
        {meal.image_url ? (
          <img
            src={meal.image_url}
            alt={meal.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '80px',
          }}>
            {meal.meal_emoji || '🍽️'}
          </div>
        )}

        {/* Botón volver */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: 'none', borderRadius: '50%',
            width: '40px', height: '40px',
            color: 'white', fontSize: '18px',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex', gap: '8px',
            flexWrap: 'wrap', marginBottom: '8px',
          }}>
            <span className="badge badge-amber">{meal.category}</span>
            {meal.is_diabetic_friendly && (
              <span className="badge badge-green">🩺 Apto diabético</span>
            )}
            {meal.prep_time_minutes && (
              <span className="badge badge-dark">⏱ {meal.prep_time_minutes} min</span>
            )}
            {meal.difficulty && (
              <span className="badge badge-dark">👨‍🍳 {meal.difficulty}</span>
            )}
          </div>

          <h1 style={{
            fontSize: '24px', fontWeight: 900,
            color: 'var(--text)', marginBottom: '8px',
            lineHeight: 1.2,
          }}>
            {meal.name}
          </h1>

          {meal.description && (
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
              {meal.description}
            </p>
          )}

          {meal.estimated_cost != null && (
            <div style={{
              marginTop: '12px',
              fontSize: '16px', fontWeight: 700,
              color: 'var(--amber)',
            }}>
              💰 ~${meal.estimated_cost} MXN
            </div>
          )}
        </div>

        {/* Ingredientes */}
        {ingredients.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '16px', fontWeight: 800,
              color: 'var(--text)', marginBottom: '12px',
            }}>
              🛒 Ingredientes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ingredients.map((ing, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                    {ing.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        {instructions.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '16px', fontWeight: 800,
              color: 'var(--text)', marginBottom: '12px',
            }}>
              📝 Preparación
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {instructions.map((inst, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: '10px', marginBottom: '6px',
                  }}>
                    <div style={{
                      width: '28px', height: '28px',
                      borderRadius: '50%',
                      background: 'var(--amber-soft)',
                      border: '1.5px solid rgba(245,158,11,0.3)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px', fontWeight: 800,
                      color: 'var(--amber)', flexShrink: 0,
                    }}>
                      {inst.step || i + 1}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      {inst.title}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '13px', color: 'var(--muted)',
                    lineHeight: 1.6, marginLeft: '38px',
                  }}>
                    {inst.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chef tip */}
        {meal.chef_tip && (
          <div style={{
            padding: '16px',
            background: 'var(--amber-soft)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 'var(--r-sm)',
          }}>
            <div style={{
              fontSize: '13px', fontWeight: 700,
              color: 'var(--amber)', marginBottom: '6px',
            }}>
              👨‍🍳 Tip del chef
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              {meal.chef_tip}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
