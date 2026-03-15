'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IngredientSearch, SelectedIngredient } from '@/components/meals/IngredientSearch'

const CATEGORIES = ['Desayuno', 'Comida', 'Cena', 'Snack']
const DIFFICULTIES = ['fácil', 'intermedio', 'chef']
const EMOJIS = [
  '🍳', '🥘', '🍲', '🌮', '🥗', '🍜',
  '🥩', '🐟', '🫕', '🥙', '🍛', '🥚',
  '🧆', '🫔', '🍱',
]

interface RecipeStep {
  step: number
  title: string
  text: string
}

export default function NuevaComidaPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)

  // Paso 1 — datos básicos
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Comida')
  const [emoji, setEmoji] = useState('🍳')
  const [prepTime, setPrepTime] = useState(30)
  const [difficulty, setDifficulty] = useState('fácil')

  // Paso 2 — ingredientes
  const [ingredients, setIngredients] = useState<SelectedIngredient[]>([])

  // Paso 3 — receta
  const [recipeMode, setRecipeMode] = useState<'auto' | 'manual' | null>(null)
  const [instructions, setInstructions] = useState<RecipeStep[]>([])
  const [description, setDescription] = useState('')
  const [chefTip, setChefTip] = useState('')
  const [generatingRecipe, setGeneratingRecipe] = useState(false)
  const [recipeGenerated, setRecipeGenerated] = useState(false)

  // Estado general
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalSteps = 4

  async function generarReceta() {
    if (ingredients.length === 0) {
      setError('Agrega al menos un ingrediente primero')
      return
    }
    setGeneratingRecipe(true)
    setRecipeMode('auto')
    setError('')

    try {
      const res = await fetch('/api/generar-receta-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: name,
          category,
          ingredients,
          family_has_diabetic: false,
        }),
      })
      const data = await res.json()

      if (data.recipe) {
        setDescription(data.recipe.description || '')
        setInstructions(data.recipe.instructions || [])
        setChefTip(data.recipe.chef_tip || '')
        setPrepTime(data.recipe.prep_time_minutes || prepTime)
        setDifficulty(data.recipe.difficulty || difficulty)
        setRecipeGenerated(true)
      } else {
        setError('Error al generar la receta. Intenta de nuevo.')
        setRecipeMode(null)
      }
    } catch {
      setError('Error al generar la receta. Intenta de nuevo.')
      setRecipeMode(null)
    } finally {
      setGeneratingRecipe(false)
    }
  }

  function addManualStep() {
    setInstructions((prev) => [
      ...prev,
      { step: prev.length + 1, title: '', text: '' },
    ])
  }

  function updateStepField(index: number, field: 'title' | 'text', value: string) {
    setInstructions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function removeStep(index: number) {
    setInstructions((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 }))
    )
  }

  function resetRecipe() {
    setRecipeMode(null)
    setRecipeGenerated(false)
    setInstructions([])
    setDescription('')
    setChefTip('')
  }

  async function guardarComida() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (ingredients.length === 0) { setError('Agrega al menos un ingrediente'); return }

    setSaving(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      const estimatedCost = ingredients.reduce(
        (sum, ing) => sum + ing.price_mxn * ing.quantity,
        0
      )

      const { error: saveError } = await supabase.from('meals').insert({
        name: name.trim(),
        description,
        category,
        meal_emoji: emoji,
        prep_time_minutes: prepTime,
        difficulty,
        estimated_cost: Math.round(estimatedCost),
        ingredients: ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          price_mxn: i.price_mxn,
        })),
        instructions,
        chef_tip: chefTip,
        is_healthy: true,
        is_diabetic_friendly: false,
        generated_by_ai: recipeMode === 'auto',
        family_id: profile?.family_id,
        tags: [category.toLowerCase()],
      })

      if (saveError) throw saveError

      router.push('/comidas')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function canProceed(): boolean {
    if (step === 1) return name.trim().length > 0
    if (step === 2) return ingredients.length > 0
    if (step === 3)
      return recipeGenerated || (recipeMode === 'manual' && instructions.length > 0)
    return true
  }

  const progress = (step / totalSteps) * 100

  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      padding: '24px 20px 40px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header con progreso */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            style={{
              background: 'none', border: 'none',
              color: 'var(--amber)', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
              padding: 0, fontFamily: 'Inter, sans-serif',
            }}
          >
            ← {step > 1 ? 'Atrás' : 'Cancelar'}
          </button>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
            {step}/{totalSteps}
          </span>
        </div>

        <div style={{
          height: '4px',
          background: 'var(--surface2)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--amber), var(--amber-dark))',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* ─── PASO 1 — Datos básicos ─────────────────────────── */}
      {step === 1 && (
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 800,
            color: 'var(--text)', marginBottom: '20px',
          }}>
            ¿Qué platillo es? 🍽️
          </h2>

          <div className="field-group">
            <label className="field-label">Nombre del platillo</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Enchiladas verdes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Categoría</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '50px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: category === cat
                      ? '1.5px solid var(--amber)'
                      : '1.5px solid var(--border)',
                    background: category === cat ? 'var(--amber-soft)' : 'var(--surface)',
                    color: category === cat ? 'var(--amber)' : 'var(--muted)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Emoji representativo</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  style={{
                    width: '44px', height: '44px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '22px',
                    cursor: 'pointer',
                    border: emoji === e
                      ? '2px solid var(--amber)'
                      : '1.5px solid var(--border)',
                    background: emoji === e ? 'var(--amber-soft)' : 'var(--surface)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">
              Tiempo de preparación: {prepTime} min
            </label>
            <input
              type="range"
              min={5} max={120} step={5}
              value={prepTime}
              onChange={(e) => setPrepTime(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--amber)' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '11px', color: 'var(--muted)',
            }}>
              <span>5 min</span><span>120 min</span>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Dificultad</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1, padding: '8px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                    border: difficulty === d
                      ? '1.5px solid var(--amber)'
                      : '1.5px solid var(--border)',
                    background: difficulty === d ? 'var(--amber-soft)' : 'var(--surface)',
                    color: difficulty === d ? 'var(--amber)' : 'var(--muted)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {d === 'fácil' ? '😊' : d === 'intermedio' ? '🧑‍🍳' : '👨‍🍳'} {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PASO 2 — Ingredientes ───────────────────────────── */}
      {step === 2 && (
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 800,
            color: 'var(--text)', marginBottom: '6px',
          }}>
            Ingredientes 🛒
          </h2>
          <p style={{
            fontSize: '13px', color: 'var(--muted)',
            marginBottom: '20px', lineHeight: 1.5,
          }}>
            Busca los ingredientes del platillo.
            Solo aparecen los que están en el catálogo HEB.
          </p>

          <IngredientSearch selected={ingredients} onChange={setIngredients} />
        </div>
      )}

      {/* ─── PASO 3 — Receta ─────────────────────────────────── */}
      {step === 3 && (
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 800,
            color: 'var(--text)', marginBottom: '6px',
          }}>
            La receta 📝
          </h2>
          <p style={{
            fontSize: '13px', color: 'var(--muted)',
            marginBottom: '20px', lineHeight: 1.5,
          }}>
            ¿Quieres que Claude genere la receta con los ingredientes
            que elegiste, o la escribes tú?
          </p>

          {/* Selector de modo */}
          {!recipeMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={generarReceta}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✨</div>
                <div style={{
                  fontSize: '15px', fontWeight: 700,
                  color: 'var(--text)', marginBottom: '4px',
                }}>
                  Generar con Claude
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Claude crea la receta automáticamente basándose
                  en los ingredientes que elegiste. Recomendado.
                </div>
              </div>

              <div
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setRecipeMode('manual')
                  addManualStep()
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✍️</div>
                <div style={{
                  fontSize: '15px', fontWeight: 700,
                  color: 'var(--text)', marginBottom: '4px',
                }}>
                  Escribir manual
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Escribe tú los pasos de la receta.
                </div>
              </div>
            </div>
          )}

          {/* Generando con Claude */}
          {generatingRecipe && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                Claude está generando la receta...
              </p>
            </div>
          )}

          {/* Receta generada */}
          {recipeGenerated && !generatingRecipe && (
            <div>
              <div style={{
                padding: '12px',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 'var(--r-sm)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>✅</span>
                <span style={{
                  fontSize: '13px', color: 'var(--green)', fontWeight: 600,
                }}>
                  ¡Receta generada por Claude!
                </span>
                <button
                  type="button"
                  onClick={() => {
                    resetRecipe()
                    setTimeout(generarReceta, 50)
                  }}
                  style={{
                    marginLeft: 'auto',
                    background: 'none', border: 'none',
                    color: 'var(--muted)', fontSize: '12px',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  🔄 Regenerar
                </button>
              </div>

              {description && (
                <p style={{
                  fontSize: '13px', color: 'var(--muted)',
                  lineHeight: 1.6, marginBottom: '16px',
                  fontStyle: 'italic',
                }}>
                  {description}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {instructions.map((inst, i) => (
                  <div key={i} style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                  }}>
                    <div style={{
                      fontSize: '11px', fontWeight: 700,
                      color: 'var(--amber)', textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}>
                      Paso {inst.step} — {inst.title}
                    </div>
                    <div style={{
                      fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5,
                    }}>
                      {inst.text}
                    </div>
                  </div>
                ))}
              </div>

              {chefTip && (
                <div style={{
                  marginTop: '12px', padding: '12px',
                  background: 'var(--amber-soft)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 'var(--r-sm)',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber)' }}>
                    👨‍🍳 Tip del chef:
                  </span>
                  <p style={{
                    fontSize: '13px', color: 'var(--muted)',
                    marginTop: '4px', lineHeight: 1.5,
                  }}>
                    {chefTip}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Modo manual */}
          {recipeMode === 'manual' && !recipeGenerated && (
            <div>
              <div className="field-group">
                <label className="field-label">Descripción breve</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Describe el platillo en 1-2 oraciones"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              <label className="field-label" style={{ marginBottom: '8px', display: 'block' }}>
                Pasos de la receta
              </label>

              {instructions.map((inst, i) => (
                <div key={i} style={{
                  padding: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  marginBottom: '8px',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber)' }}>
                      Paso {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--red)', cursor: 'pointer',
                        fontSize: '13px', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      × Eliminar
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder="Título del paso"
                    value={inst.title}
                    onChange={(e) => updateStepField(i, 'title', e.target.value)}
                    style={{ marginBottom: '6px' }}
                  />
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Descripción del paso"
                    value={inst.text}
                    onChange={(e) => updateStepField(i, 'text', e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </div>
              ))}

              <button
                type="button"
                className="btn-ghost"
                onClick={addManualStep}
                style={{ width: '100%', marginBottom: '12px' }}
              >
                + Agregar paso
              </button>

              <div className="field-group">
                <label className="field-label">Tip del chef (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Un truco profesional..."
                  value={chefTip}
                  onChange={(e) => setChefTip(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" style={{ marginTop: '12px' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── PASO 4 — Confirmar ──────────────────────────────── */}
      {step === 4 && (
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 800,
            color: 'var(--text)', marginBottom: '20px',
          }}>
            Confirmar comida ✅
          </h2>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>
              {emoji}
            </div>
            <div style={{
              fontSize: '18px', fontWeight: 800,
              color: 'var(--text)', textAlign: 'center', marginBottom: '8px',
            }}>
              {name}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'center',
              gap: '8px', flexWrap: 'wrap', marginBottom: '16px',
            }}>
              <span className="badge-amber">{category}</span>
              <span className="badge-dark">{prepTime} min</span>
              <span className="badge-dark">{difficulty}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{
                fontSize: '12px', fontWeight: 700,
                color: 'var(--muted)', marginBottom: '6px',
              }}>
                {ingredients.length} INGREDIENTES
              </div>
              {ingredients.slice(0, 4).map((ing) => (
                <div key={ing.id} style={{
                  fontSize: '13px', color: 'var(--muted)', padding: '2px 0',
                }}>
                  • {ing.quantity} {ing.unit} {ing.name}
                </div>
              ))}
              {ingredients.length > 4 && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  +{ingredients.length - 4} más...
                </div>
              )}
            </div>

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '12px', marginTop: '12px',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Costo estimado
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--amber)' }}>
                ${ingredients
                  .reduce((s, i) => s + i.price_mxn * i.quantity, 0)
                  .toFixed(0)}{' '}
                MXN
              </span>
            </div>

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '12px', marginTop: '8px',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Receta</span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color:
                  recipeGenerated || instructions.length > 0
                    ? 'var(--green)'
                    : 'var(--muted)',
              }}>
                {recipeGenerated
                  ? '✅ Generada por Claude'
                  : instructions.length > 0
                  ? '✅ Manual'
                  : '⚠️ Sin receta'}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Botones de navegación */}
      <div style={{
        display: 'flex', gap: '10px',
        marginTop: 'auto', paddingTop: '20px',
      }}>
        {step > 1 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep(step - 1)}
            style={{ flex: 1 }}
          >
            ← Atrás
          </button>
        )}

        {step < totalSteps ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{ flex: 1, opacity: canProceed() ? 1 : 0.5 }}
          >
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={guardarComida}
            disabled={saving}
            style={{ flex: 1 }}
          >
            {saving ? 'Guardando...' : '✅ Agregar comida'}
          </button>
        )}
      </div>
    </div>
  )
}
