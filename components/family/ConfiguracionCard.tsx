'use client'

import { useState, useEffect } from 'react'
import { Save, Sparkles, Bell, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

interface FamilyData {
  id: string
  name: string
  invite_code: string
  budget_weekly: number | null
}

interface MemberData {
  id: string
  name: string
  role: string
}

interface Props {
  family: FamilyData
  members: MemberData[]
  onUpdate: () => void
}

export function ConfiguracionCard({ family, members, onUpdate }: Props) {
  const [budgetInput, setBudgetInput] = useState(
    family.budget_weekly != null ? String(family.budget_weekly) : ''
  )
  const [savingBudget, setSavingBudget] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [memberPrefs, setMemberPrefs] = useState<Record<string, boolean>>({})
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const toast = useToast()
  const supabase = createClient()

  // Cargar estado de preferencias al montar
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('profile_id, preferences_completed')
          .eq('family_id', family.id)
          .eq('preferences_completed', true)

        const filled: Record<string, boolean> = {}
        for (const m of members) {
          const completado = (data ?? []).find(
            (p: { profile_id: string; preferences_completed: boolean }) =>
              p.profile_id === m.id && p.preferences_completed === true
          )
          filled[m.id] = !!completado
        }
        setMemberPrefs(filled)
        setPrefsLoaded(true)
      } catch {
        // tabla puede no existir todavía — no bloquear la UI
        setPrefsLoaded(true)
      }
    }
    loadPrefs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id])

  const saveBudget = async () => {
    const val = parseFloat(budgetInput.replace(/,/g, ''))
    if (isNaN(val) || val <= 0) {
      toast.error('Ingresa un monto válido.')
      return
    }
    setSavingBudget(true)
    try {
      const { error } = await supabase
        .from('families')
        .update({ budget_weekly: val })
        .eq('id', family.id)
      if (error) throw error
      toast.success('Presupuesto guardado.')
      onUpdate()
    } catch {
      toast.error('No se pudo guardar el presupuesto.')
    } finally {
      setSavingBudget(false)
    }
  }

  const notificarPreferencias = async () => {
    setNotifying(true)
    try {
      const res = await fetch('/api/familia/notificar-preferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: family.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('✅ Notificación enviada — los miembros serán redirigidos a llenar sus preferencias')
    } catch {
      toast.error('No se pudo enviar la notificación.')
    } finally {
      setNotifying(false)
    }
  }

  const generarRecetas = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/generar-recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: family.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('¡Recetas generadas! Ya pueden votar.')
      onUpdate()
    } catch {
      toast.error('No se pudo generar el catálogo de recetas.')
    } finally {
      setGenerating(false)
    }
  }

  const allFilled = prefsLoaded && members.every((m) => memberPrefs[m.id])
  const filledCount = Object.values(memberPrefs).filter(Boolean).length

  return (
    <>
      {/* ── PRESUPUESTO ──────────────────────────────── */}
      <section>
        <h3 className="section-title mb-12">Presupuesto semanal</h3>
        <div className="card stack-4">
          <div className="budget-input-wrap">
            <span className="budget-prefix">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="1,000"
              className="input budget-input"
            />
            <span className="budget-suffix">MXN</span>
          </div>
          <p className="text-muted fs-12">
            Para una familia de 4 en Monterrey, el promedio es $850–$950/semana
          </p>

          {family.budget_weekly != null && family.budget_weekly > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="progress-track" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: '100%' }} />
              </div>
              <span className="fs-12 text-amber fw-700">
                ${family.budget_weekly.toFixed(0)} MXN / semana
              </span>
            </div>
          )}

          <Button
            fullWidth
            variant="primary"
            size="sm"
            loading={savingBudget}
            onClick={saveBudget}
            icon={<Save style={{ width: 16, height: 16 }} />}
          >
            Guardar presupuesto
          </Button>
        </div>
      </section>

      {/* ── PREFERENCIAS DE MIEMBROS ────────────────── */}
      <section>
        <h3 className="section-title mb-12">Preferencias de la semana</h3>
        <div className="card stack-3">
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {prefsLoaded
              ? `${filledCount} de ${members.length} miembros han llenado sus preferencias`
              : 'Verificando preferencias...'
            }
          </p>

          {prefsLoaded && members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 20, height: 20,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: memberPrefs[m.id] ? 'var(--green)' : 'var(--surface3)',
                  flexShrink: 0,
                }}
              >
                {memberPrefs[m.id] && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
              </div>
              <span style={{ fontSize: 13, color: memberPrefs[m.id] ? 'var(--text)' : 'var(--muted)', flex: 1 }}>
                {m.name}
              </span>
              {memberPrefs[m.id] && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Listo</span>
              )}
            </div>
          ))}

          <Button
            fullWidth
            variant="outline"
            size="sm"
            loading={notifying}
            onClick={notificarPreferencias}
            icon={<Bell style={{ width: 16, height: 16 }} />}
          >
            Notificar a llenar preferencias
          </Button>
        </div>
      </section>

      {/* ── GENERAR RECETAS ──────────────────────────── */}
      <section>
        <h3 className="section-title mb-12">Catálogo de recetas</h3>
        <div className="card stack-3">
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            {allFilled
              ? '¡Todos llenaron sus preferencias! Genera el catálogo para esta semana.'
              : `Espera a que todos llenen sus preferencias (${filledCount}/${members.length}).`
            }
          </p>

          <Button
            fullWidth
            variant={allFilled ? 'primary' : 'outline'}
            loading={generating}
            onClick={generarRecetas}
            disabled={!allFilled && prefsLoaded}
            icon={generating
              ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
              : <Sparkles style={{ width: 18, height: 18 }} />
            }
          >
            {generating ? 'Generando...' : 'Generar catálogo de recetas'}
          </Button>

          {!allFilled && prefsLoaded && (
            <p style={{ fontSize: 11, color: 'var(--hint)', textAlign: 'center' }}>
              Disponible cuando todos los miembros llenen sus preferencias
            </p>
          )}
        </div>
      </section>
    </>
  )
}
