'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const LIKES_OPTIONS = [
  'Pollo', 'Res', 'Cerdo', 'Pescado', 'Mariscos',
  'Pasta', 'Arroz', 'Ensaladas', 'Sopas', 'Tacos',
  'Enchiladas', 'Pozole', 'Verduras', 'Frijoles',
  'Huevo', 'Desayunos ligeros', 'Platillos mexicanos',
  'Comida italiana', 'Comida saludable', 'Tamales',
  'Chilaquiles', 'Quesadillas', 'Sushi', 'Pizza'
]

const ALLERGIES_OPTIONS = [
  'Gluten', 'Lácteos', 'Mariscos', 'Nueces',
  'Cacahuate', 'Huevo', 'Soya', 'Maíz',
  'Chile picante', 'Cerdo', 'Res', 'Sin restricciones'
]

export default function PreferenciasPage() {
  const [step, setStep] = useState(1)
  const [likes, setLikes] = useState<string[]>([])
  const [dislikes, setDislikes] = useState<string[]>([])
  const [allergies, setAllergies] = useState<string[]>([])
  const [isDiabetic, setIsDiabetic] = useState(false)
  const [isVegetarian, setIsVegetarian] = useState(false)
  const [isVegan, setIsVegan] = useState(false)
  const [isHealthy, setIsHealthy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileId, setProfileId] = useState('')
  const [familyId, setFamilyId] = useState('')
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      setProfileId(profile.id)
      setFamilyId(profile.family_id)
    }
  }

  function toggleItem(
    item: string,
    list: string[],
    setList: (l: string[]) => void
  ) {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item))
    } else {
      setList([...list, item])
    }
  }

  async function guardarPreferencias() {
    if (likes.length === 0) {
      alert('Selecciona al menos una comida que te guste')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('No hay sesión activa')
      setLoading(false)
      return
    }

    const weekNumber = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    try {
      // Borrar registros anteriores de este usuario
      await supabase
        .from('user_preferences')
        .delete()
        .eq('profile_id', user.id)

      // Insertar registro fresco
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          profile_id: user.id,
          family_id: familyId,
          likes,
          dislikes,
          allergies,
          is_diabetic: isDiabetic,
          is_vegetarian: isVegetarian,
          is_vegan: isVegan,
          preferences_completed: true,
          week_number: weekNumber,
          year,
          completed_at: new Date().toISOString(),
          notified_at: new Date().toISOString(),
        })

      if (insertError) {
        console.log('Insert error:', JSON.stringify(insertError))
        throw insertError
      }

      router.push('/inicio')

    } catch (err: unknown) {
      console.log('Catch error:', err)
      const e = err as { message?: string; details?: string }
      setError(e?.message || e?.details || 'Error al guardar preferencias')
    } finally {
      setLoading(false)
    }
  }

  const totalSteps = 4
  const progress = (step / totalSteps) * 100

  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      padding: '24px 20px 40px',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Header con progreso */}
      <div style={{marginBottom: '28px'}}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text)'
          }}>
            Mis preferencias
          </h1>
          <span style={{
            fontSize: '13px',
            color: 'var(--muted)',
            fontWeight: 600
          }}>
            {step}/{totalSteps}
          </span>
        </div>

        {/* Barra de progreso */}
        <div style={{
          height: '4px',
          background: 'var(--surface2)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--amber), var(--amber-dark))',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }}/>
        </div>
      </div>

      {/* PASO 1 — Qué te gusta */}
      {step === 1 && (
        <div style={{flex: 1}}>
          <div style={{marginBottom: '20px'}}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: '6px'
            }}>
              ¿Qué te gusta comer? 😋
            </h2>
            <p style={{fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5}}>
              Selecciona todo lo que disfrutes. Estas opciones
              aparecerán en tu menú semanal.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '32px'
          }}>
            {LIKES_OPTIONS.map(item => (
              <button
                key={item}
                onClick={() => toggleItem(item, likes, setLikes)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '50px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: likes.includes(item)
                    ? '1.5px solid rgba(34,197,94,0.5)'
                    : '1.5px solid var(--border)',
                  background: likes.includes(item)
                    ? 'rgba(34,197,94,0.1)'
                    : 'var(--surface)',
                  color: likes.includes(item)
                    ? 'var(--green)'
                    : 'var(--muted)',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {likes.includes(item) ? '✓ ' : ''}{item}
              </button>
            ))}
          </div>

          {likes.length > 0 && (
            <p style={{
              fontSize: '12px',
              color: 'var(--amber)',
              marginBottom: '16px',
              fontWeight: 600
            }}>
              {likes.length} seleccionado{likes.length !== 1 ? 's' : ''} ✓
            </p>
          )}
        </div>
      )}

      {/* PASO 2 — Qué NO te gusta */}
      {step === 2 && (
        <div style={{flex: 1}}>
          <div style={{marginBottom: '20px'}}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: '6px'
            }}>
              ¿Qué NO quieres comer? 🚫
            </h2>
            <p style={{fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5}}>
              Estos platillos o ingredientes no aparecerán
              en tu menú. Puedes saltar este paso.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '32px'
          }}>
            {LIKES_OPTIONS.map(item => (
              <button
                key={item}
                onClick={() => toggleItem(item, dislikes, setDislikes)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '50px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: dislikes.includes(item)
                    ? '1.5px solid rgba(239,68,68,0.5)'
                    : '1.5px solid var(--border)',
                  background: dislikes.includes(item)
                    ? 'rgba(239,68,68,0.1)'
                    : 'var(--surface)',
                  color: dislikes.includes(item)
                    ? 'var(--red)'
                    : 'var(--muted)',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {dislikes.includes(item) ? '✕ ' : ''}{item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 3 — Alergias */}
      {step === 3 && (
        <div style={{flex: 1}}>
          <div style={{marginBottom: '20px'}}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: '6px'
            }}>
              ¿Tienes alergias? ⚠️
            </h2>
            <p style={{fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5}}>
              Estos ingredientes serán evitados en todas
              tus recetas. Puedes saltar si no tienes.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '32px'
          }}>
            {ALLERGIES_OPTIONS.map(item => (
              <button
                key={item}
                onClick={() => toggleItem(item, allergies, setAllergies)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '50px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: allergies.includes(item)
                    ? '1.5px solid rgba(245,158,11,0.5)'
                    : '1.5px solid var(--border)',
                  background: allergies.includes(item)
                    ? 'var(--amber-soft)'
                    : 'var(--surface)',
                  color: allergies.includes(item)
                    ? 'var(--amber)'
                    : 'var(--muted)',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {allergies.includes(item) ? '⚠ ' : ''}{item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 4 — Condiciones de salud */}
      {step === 4 && (
        <div style={{flex: 1}}>
          <div style={{marginBottom: '24px'}}>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text)',
              marginBottom: '6px'
            }}>
              Condiciones de salud 🩺
            </h2>
            <p style={{fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5}}>
              Esto nos ayuda a personalizar las recetas
              para que sean seguras y apropiadas para ti.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '32px'
          }}>
            {[
              {
                key: 'diabetic',
                emoji: '🩺',
                label: 'Soy diabético/a',
                sub: 'Se priorizarán recetas con bajo índice glucémico',
                value: isDiabetic,
                set: setIsDiabetic
              },
              {
                key: 'vegetarian',
                emoji: '🥗',
                label: 'Soy vegetariano/a',
                sub: 'No se incluirá carne ni pollo',
                value: isVegetarian,
                set: setIsVegetarian
              },
              {
                key: 'vegan',
                emoji: '🌱',
                label: 'Soy vegano/a',
                sub: 'Sin ningún producto de origen animal',
                value: isVegan,
                set: setIsVegan
              },
              {
                key: 'healthy',
                emoji: '💪',
                label: 'Quiero comer saludable',
                sub: 'Se priorizarán recetas nutritivas y balanceadas',
                value: isHealthy,
                set: setIsHealthy
              }
            ].map(item => (
              <div
                key={item.key}
                onClick={() => item.set(!item.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  borderRadius: 'var(--r-sm)',
                  background: item.value
                    ? 'rgba(245,158,11,0.08)'
                    : 'var(--surface)',
                  border: item.value
                    ? '1.5px solid rgba(245,158,11,0.3)'
                    : '1.5px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{fontSize: '24px'}}>{item.emoji}</span>
                <div style={{flex: 1}}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: '2px'
                  }}>
                    {item.label}
                  </div>
                  <div style={{fontSize: '12px', color: 'var(--muted)'}}>
                    {item.sub}
                  </div>
                </div>
                {/* Toggle */}
                <div style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  background: item.value
                    ? 'var(--amber)'
                    : 'var(--surface2)',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                  flexShrink: 0
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '3px',
                    left: item.value ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botones de navegación */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: 'auto',
        paddingTop: '16px'
      }}>
        {step > 1 && (
          <button
            className="btn-ghost"
            onClick={() => setStep(step - 1)}
            style={{flex: 1}}
          >
            ← Atrás
          </button>
        )}

        {step < totalSteps ? (
          <button
            className="btn-primary"
            onClick={() => {
              if (step === 1 && likes.length === 0) {
                alert('Selecciona al menos una comida que te guste')
                return
              }
              setStep(step + 1)
            }}
            style={{flex: 1}}
          >
            Siguiente →
          </button>
        ) : (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {error && (
              <div style={{
                fontSize: '13px',
                color: 'var(--red)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-sm)',
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}
            <button
              className="btn-primary"
              onClick={guardarPreferencias}
              disabled={loading}
            >
              {loading ? 'Guardando...' : '✅ Guardar preferencias'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}
