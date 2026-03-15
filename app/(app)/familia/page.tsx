'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, LogOut, Crown, User, Users, Sparkles, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Family, Profile, WeeklyMenu } from '@/types'
import { getWeekStart, toDateString } from '@/lib/utils'

export default function FamiliaPage() {
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [codeCopied, setCodeCopied] = useState(false)
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showGroq, setShowGroq] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  // Presupuesto
  const [budgetInput, setBudgetInput] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [gastado, setGastado] = useState(0)

  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!prof) return
      setMyProfile(prof)

      if (!prof.family_id) { setLoading(false); return }

      const weekStart = toDateString(getWeekStart())
      const [{ data: fam }, { data: mems }, { data: menu }] = await Promise.all([
        supabase.from('families').select('*').eq('id', prof.family_id).single(),
        supabase.from('profiles').select('*').eq('family_id', prof.family_id).order('created_at'),
        supabase
          .from('weekly_menu')
          .select('*, meal:meals(estimated_cost)')
          .eq('family_id', prof.family_id)
          .eq('week_start', weekStart),
      ])

      setFamily(fam)
      setMembers(mems ?? [])
      if (fam?.budget_weekly) setBudgetInput(String(fam.budget_weekly))

      const totalGastado = (menu ?? []).reduce((sum, entry) => {
        const cost = (entry.meal as { estimated_cost?: number } | null)?.estimated_cost ?? 0
        return sum + cost
      }, 0)
      setGastado(totalGastado)
      setLoading(false)
    }
    load()
  }, [])

  const copyCode = async () => {
    if (!family) return
    try {
      await navigator.clipboard.writeText(family.invite_code)
      setCodeCopied(true)
      toast.success('Código copiado al portapapeles.')
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Compártelo manualmente.')
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoggingOut(false)
      setShowLogout(false)
    }
  }

  const saveBudget = async () => {
    if (!family) return
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
      setFamily((prev) => prev ? { ...prev, budget_weekly: val } : prev)
      toast.success('Presupuesto guardado.')
    } catch {
      toast.error('No se pudo guardar el presupuesto.')
    } finally {
      setSavingBudget(false)
    }
  }

  const loadSuggestions = async () => {
    setLoadingSuggestions(true)
    try {
      const { data: meals } = await supabase
        .from('meals')
        .select('name')
        .eq('family_id', family?.id ?? '')

      const existingNames = (meals ?? []).map((m: { name: string }) => m.name)

      const res = await fetch('/api/sugerir-comida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingMeals: existingNames }),
      })

      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      setSuggestions(data.map((s: { name: string }) => s.name))
    } catch {
      toast.error('Algo salió mal al pedir sugerencias.')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const roleBadgeClass: Record<string, string> = {
    admin:  'role-badge role-badge-admin',
    member: 'role-badge role-badge-member',
    child:  'role-badge role-badge-child',
  }
  const roleLabels: Record<string, string> = {
    admin: 'Admin', member: 'Miembro', child: 'Niño/a',
  }

  if (loading) return <><PageHeader title="Familia" /><PageLoader message="Cargando familia..." /></>

  return (
    <div>
      <PageHeader title="Mi familia" />

      <div className="page-content-spacious stack-6">
        {family && (
          <div className="family-hero">
            <div className="family-hero-label">
              <Users style={{ width: 20, height: 20 }} />
              Tu familia
            </div>
            <h2 className="family-hero-name">{family.name}</h2>
            <p className="family-hero-count">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
          </div>
        )}

        {family && (
          <section>
            <h3 className="section-title mb-12">Invitar a la familia</h3>
            <div className="card">
              <p className="invite-description">
                Comparte este código para que otros se unan a tu familia
              </p>
              <div className="invite-code-row">
                <div className="code-display">
                  <span className="code-text">{family.invite_code}</span>
                </div>
                <button onClick={copyCode} className="btn-copy">
                  {codeCopied ? <Check style={{ width: 20, height: 20 }} /> : <Copy style={{ width: 20, height: 20 }} />}
                  {codeCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="section-title mb-12">Miembros</h3>
          <div className="stack-2">
            {members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-avatar">
                  {member.role === 'admin' ? (
                    <Crown style={{ width: 20, height: 20 }} />
                  ) : (
                    <User style={{ width: 18, height: 18 }} />
                  )}
                </div>
                <div className="member-info">
                  <p className="member-name">
                    {member.name}
                    {member.id === myProfile?.id && (
                      <span className="member-you">(Tú)</span>
                    )}
                  </p>
                </div>
                <span className={roleBadgeClass[member.role] ?? 'role-badge'}>
                  {roleLabels[member.role]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRESUPUESTO SEMANAL ────────────────── */}
        {family && (
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

              {family.budget_weekly != null && family.budget_weekly > 0 && (() => {
                const total = family.budget_weekly
                const porcentaje = (gastado / total) * 100
                const overBudget = gastado > total
                return (
                  <div>
                    <div className="flex justify-between mb-8">
                      <span className="fs-12 text-muted">Comprometido esta semana</span>
                      <span className={`fs-12 fw-700 ${overBudget ? 'text-red' : 'text-amber'}`}>
                        ${gastado.toFixed(0)} / ${total.toFixed(0)}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(porcentaje, 100)}%`,
                          background: overBudget ? 'var(--red)' : undefined,
                        }}
                      />
                    </div>
                    {overBudget && (
                      <p className="budget-over-msg">
                        ⚠️ Superaste el presupuesto por ${(gastado - total).toFixed(0)}
                      </p>
                    )}
                  </div>
                )
              })()}

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
        )}

        <section>
          <h3 className="section-title mb-12">Sugerencias de comida (IA)</h3>
          <div className="card stack-3">
            <p className="text-muted fs-13">
              Usa Groq IA para obtener ideas de platillos que tu familia no ha probado
            </p>
            <Button
              fullWidth
              variant="outline"
              onClick={() => { loadSuggestions(); setShowGroq(true) }}
              icon={<Sparkles style={{ width: 20, height: 20 }} />}
            >
              Pedir sugerencias
            </Button>

            {showGroq && (
              <div className="stack-2 mt-8">
                {loadingSuggestions ? (
                  <div className="loading-row">
                    <div className="spinner" />
                    <p className="loading-text">Pensando ideas para tu familia...</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <>
                    <p className="pending-label">Sugerencias</p>
                    {suggestions.map((s, i) => (
                      <div key={i} className="suggestion-row">
                        <span className="suggestion-num">{i + 1}.</span>
                        <span className="suggestion-text">{s}</span>
                      </div>
                    ))}
                    <Button
                      fullWidth
                      variant="ghost"
                      size="sm"
                      onClick={loadSuggestions}
                      loading={loadingSuggestions}
                    >
                      Pedir más ideas
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section>
          <Button
            fullWidth
            variant="secondary"
            onClick={() => setShowLogout(true)}
            icon={<LogOut style={{ width: 20, height: 20 }} />}
          >
            Cerrar sesión
          </Button>
        </section>
      </div>

      <ConfirmModal
        open={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={handleLogout}
        title="Cerrar sesión"
        message="¿Seguro que quieres cerrar sesión?"
        confirmText="Sí, salir"
        cancelText="Cancelar"
        loading={loggingOut}
        variant="danger"
      />
    </div>
  )
}
