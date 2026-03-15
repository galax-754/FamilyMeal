'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, LogOut, Crown, Users, Share2, Sparkles, Bot, Sunrise, Sun, Moon, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ConfiguracionCard } from '@/components/family/ConfiguracionCard'
import { createClient } from '@/lib/supabase/client'
import { getWeekNumber } from '@/lib/votes'
import { getWeekStart, toDateString } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface FamilyData {
  id: string
  name: string
  invite_code: string
  budget_weekly: number | null
  match_mode?: string
}

interface MemberData {
  id: string
  name: string
  role: string
  avatar_color?: string
}

interface MenuProgress {
  desayunos: number
  comidas: number
  cenas: number
  votingStarted: boolean
}

const AVATAR_COLORS = ['av-amber', 'av-pink', 'av-indigo', 'av-green']

const roleBadgeClass: Record<string, string> = {
  admin:  'role-badge role-badge-admin',
  member: 'role-badge role-badge-member',
  child:  'role-badge role-badge-child',
}
const roleLabels: Record<string, string> = {
  admin: 'Admin', member: 'Miembro', child: 'Niño/a',
}

export default function FamiliaPage() {
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState<FamilyData | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Estado del menú semanal
  const [menuProgress, setMenuProgress] = useState<MenuProgress | null>(null)
  const [matchMode, setMatchMode] = useState<string>('full')
  const [actionLoading, setActionLoading] = useState(false)
  const [updatingImages, setUpdatingImages] = useState(false)
  const [memberPrefsStatus, setMemberPrefsStatus] = useState<Record<string, boolean>>({})
  const [mealsByCategory, setMealsByCategory] = useState<Record<string, number>>({})

  const toast = useToast()
  const router = useRouter()
  const supabase = createClient()

  async function loadFamilyData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, families(*)')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.family_id) {
        setError('No tienes una familia configurada aún')
        setLoading(false)
        return
      }

      const fam = profile.families as FamilyData
      setFamily(fam)
      setIsAdmin(profile.role === 'admin')
      setMatchMode(fam.match_mode ?? 'full')

      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}/unirse?codigo=${fam.invite_code}`)

      const weekNumber = getWeekNumber(new Date())
      const year = new Date().getFullYear()
      const weekStart = toDateString(getWeekStart())

      const [{ data: membersData }, { data: weeklyMenuData }, { data: votingStatus }, { data: preferencesData }, { data: mealsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, role')
          .eq('family_id', profile.family_id)
          .order('created_at'),
        supabase
          .from('weekly_menu')
          .select('meal_type')
          .eq('family_id', profile.family_id)
          .eq('week_start', weekStart),
        supabase
          .from('weekly_voting_status')
          .select('recipes_generated, voting_started')
          .eq('family_id', profile.family_id)
          .eq('week_number', weekNumber)
          .eq('year', year)
          .maybeSingle(),
        supabase
          .from('user_preferences')
          .select('profile_id, preferences_completed')
          .eq('family_id', profile.family_id)
          .eq('preferences_completed', true),
        supabase
          .from('meals')
          .select('category')
          .eq('family_id', profile.family_id),
      ])

      const membersList = (membersData ?? []) as MemberData[]
      setMembers(membersList)

      const statusMap: Record<string, boolean> = {}
      for (const member of membersList) {
        const completado = (preferencesData ?? []).find(
          (pref) => pref.profile_id === member.id && pref.preferences_completed === true
        )
        statusMap[member.id] = !!completado
      }
      setMemberPrefsStatus(statusMap)

      // Contar comidas disponibles por categoría
      const countByCategory: Record<string, number> = {}
      for (const meal of mealsData ?? []) {
        countByCategory[meal.category] = (countByCategory[meal.category] ?? 0) + 1
      }
      setMealsByCategory(countByCategory)

      // Conteos directamente del weekly_menu (fuente de verdad)
      const entries = weeklyMenuData ?? []
      const recipesGenerated = votingStatus?.recipes_generated ?? false
      const votingStarted    = votingStatus?.voting_started    ?? false

      if (recipesGenerated || votingStarted || entries.length > 0) {
        setMenuProgress({
          desayunos:     entries.filter((e) => e.meal_type === 'desayuno').length,
          comidas:       entries.filter((e) => e.meal_type === 'comida').length,
          cenas:         entries.filter((e) => e.meal_type === 'cena').length,
          votingStarted: true,
        })
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar los datos de tu familia')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFamilyData() }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      toast.success('Link copiado al portapapeles.')
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      toast.error('No se pudo copiar. Compártelo manualmente.')
    }
  }

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Únete a nuestra familia en FamilyMeal 🍽️\n${inviteLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
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

  // Umbral: si una categoría tiene menos de 6 recetas sin match, necesita más opciones para votar
  const UNVOTED_THRESHOLD = 6
  const matched = {
    desayuno: menuProgress?.desayunos ?? 0,
    comida:   menuProgress?.comidas   ?? 0,
    cena:     menuProgress?.cenas     ?? 0,
  }
  const categoriasConPocasOpciones = (['desayuno', 'comida', 'cena'] as const).filter(
    (cat) => (mealsByCategory[cat] ?? 0) - matched[cat] < UNVOTED_THRESHOLD
  )
  const labelGenerarBtn = categoriasConPocasOpciones.length > 0
    ? 'Generar más recetas para votar'
    : 'Generar recetas adicionales'

  const handleGenerarMasRecetas = async () => {
    if (!family) return
    setActionLoading(true)
    try {
      const categoriasAGenerar = categoriasConPocasOpciones.length > 0
        ? [...categoriasConPocasOpciones]
        : ['desayuno', 'comida', 'cena']

      const res = await fetch('/api/generar-recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: family.id, only_categories: categoriasAGenerar }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.total === 0) {
        toast.success('No se generaron recetas nuevas.')
      } else {
        toast.success(`Se generaron ${data.total} recetas nuevas para votar ✨`)
        await loadFamilyData()
      }
    } catch (err) {
      console.error(err)
      toast.error('No se pudieron generar las recetas. Intenta de nuevo.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleActivarMayoria = async () => {
    if (!family) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/familia/activar-mayoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: family.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMatchMode('majority')
      if (data.new_matches > 0) {
        toast.success(`Se encontraron ${data.new_matches} matches nuevos con mayoría`)
        await loadFamilyData()
      } else {
        toast.success('Match con mayoría activado. Los próximos votos usarán este criterio.')
      }
    } catch (err) {
      console.error(err)
      toast.error('No se pudo activar el modo mayoría.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompletarAuto = async () => {
    if (!family) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/familia/completar-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: family.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.assigned > 0) {
        toast.success(`Se asignaron ${data.assigned} comidas automáticamente`)
        await loadFamilyData()
      } else {
        toast.success('No había recetas con votos suficientes para asignar.')
      }
    } catch (err) {
      console.error(err)
      toast.error('No se pudo completar el menú automáticamente.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <><PageHeader title="Familia" /><PageLoader message="Cargando familia..." /></>

  if (error) {
    return (
      <div>
        <PageHeader title="Familia" />
        <div className="page-content">
          <div className="error-banner">{error}</div>
        </div>
      </div>
    )
  }

  const totalMatches = menuProgress
    ? menuProgress.desayunos + menuProgress.comidas + menuProgress.cenas
    : 0
  const showProgressPanel = isAdmin && menuProgress && menuProgress.votingStarted

  return (
    <div>
      <PageHeader title="Mi familia" />

      <div className="page-content-spacious stack-6">

        {/* ── PANEL PROGRESO MENÚ (solo admin cuando hay votación activa) ── */}
        {showProgressPanel && (
          <div className="card" style={{ marginBottom: '4px' }}>

            {/* Header con progreso total */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  Progreso del menú semanal
                </span>
                <span className={`badge ${totalMatches === 21 ? 'badge-green' : 'badge-amber'}`}>
                  {totalMatches}/21
                </span>
              </div>

              {[
                { label: 'Desayunos', matched: menuProgress!.desayunos, Icon: Sunrise },
                { label: 'Comidas',   matched: menuProgress!.comidas,   Icon: Sun },
                { label: 'Cenas',     matched: menuProgress!.cenas,     Icon: Moon },
              ].map(({ label, matched, Icon }) => (
                <div key={label} style={{ marginBottom: '10px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon style={{ width: 12, height: 12 }} /> {label}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: matched === 7 ? 'var(--green)' : 'var(--amber)',
                    }}>
                      {matched}/7
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(matched / 7) * 100}%`,
                        background: matched === 7
                          ? 'var(--green)'
                          : 'linear-gradient(90deg, var(--amber), var(--amber-dark))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className={totalMatches < 21 ? 'btn-primary' : 'btn-ghost'}
                onClick={handleGenerarMasRecetas}
                disabled={actionLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Sparkles style={{ width: 16, height: 16 }} />
                {actionLoading ? 'Generando...' : labelGenerarBtn}
              </button>

              {totalMatches < 21 && (
                <>
                  <button
                    className="btn-ghost"
                    onClick={handleActivarMayoria}
                    disabled={actionLoading || matchMode === 'majority'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Users style={{ width: 16, height: 16 }} />
                    {matchMode === 'majority'
                      ? 'Match con mayoría activado'
                      : 'Activar match con mayoría (3/4)'}
                  </button>

                  {totalMatches >= 16 && (
                    <button
                      className="btn-ghost"
                      onClick={handleCompletarAuto}
                      disabled={actionLoading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        borderColor: 'rgba(96,165,250,0.35)',
                        color: 'var(--blue)',
                      }}
                    >
                      <Bot style={{ width: 16, height: 16 }} />
                      Completar menú automáticamente
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Menú completo */}
            {totalMatches === 21 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px',
                background: 'rgba(34,197,94,0.08)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: 'var(--green)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                    ¡Menú completo!
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Las 21 comidas de la semana están listas
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HERO ────────────────────────────────────────── */}
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

        {/* ── MIEMBROS ─────────────────────────────────────── */}
        <section>
          <h3 className="section-title mb-12">Miembros</h3>
          <div className="stack-2">
            {members.map((member, idx) => (
              <div key={member.id} className="member-row">
                <div className={`avatar avatar-md ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                  {member.role === 'admin'
                    ? <Crown style={{ width: 16, height: 16 }} />
                    : member.name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="member-info">
                  <p className="member-name">
                    {member.name}
                    {member.id === myId && (
                      <span className="member-you">(Tú)</span>
                    )}
                  </p>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: memberPrefsStatus[member.id]
                      ? 'var(--green)'
                      : 'var(--amber)',
                  }}>
                    {memberPrefsStatus[member.id]
                      ? '✓ Preferencias listas'
                      : '⏳ Preferencias pendientes'}
                  </span>
                </div>
                <span className={roleBadgeClass[member.role] ?? 'role-badge'}>
                  {roleLabels[member.role]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── INVITAR MIEMBROS ─────────────────────────────── */}
        {family && (
          <section>
            <h3 className="section-title mb-12">Invitar miembros</h3>
            <div className="card stack-3">
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Comparte este link para que tu familia se una
              </p>
              <div style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--r-sm)',
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--muted)',
                wordBreak: 'break-all',
                border: '1px solid var(--border)',
                lineHeight: 1.5,
              }}>
                {inviteLink}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-copy"
                  style={{ flex: 1, borderRadius: 'var(--r-sm)' }}
                  onClick={copyLink}
                >
                  {linkCopied
                    ? <><Check style={{ width: 16, height: 16 }} /> Copiado</>
                    : <><Copy style={{ width: 16, height: 16 }} /> Copiar link</>
                  }
                </button>
                <button
                  onClick={shareWhatsApp}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '0 16px',
                    minHeight: 48,
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border-med)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <Share2 style={{ width: 16, height: 16 }} />
                  WhatsApp
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--hint)', textAlign: 'center' }}>
                Código de respaldo: <strong style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{family.invite_code}</strong>
              </p>
            </div>
          </section>
        )}

        {/* ── CONFIGURACIÓN (solo admin) ──────────────────── */}
        {isAdmin && family && (
          <ConfiguracionCard
            family={family}
            members={members}
            onUpdate={loadFamilyData}
          />
        )}

        {/* ── ACTUALIZAR IMÁGENES (solo admin) ────────────── */}
        {isAdmin && family && (
          <section>
            <button
              onClick={async () => {
                setUpdatingImages(true)
                try {
                  const res = await fetch('/api/actualizar-imagenes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ family_id: family.id }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error)
                  toast.success(`${data.updated} imágenes actualizadas correctamente`)
                } catch {
                  toast.error('No se pudieron actualizar las imágenes.')
                } finally {
                  setUpdatingImages(false)
                }
              }}
              disabled={updatingImages}
              className="btn-ghost"
              style={{ width: '100%' }}
            >
              {updatingImages ? '🔄 Actualizando imágenes...' : '🖼️ Actualizar imágenes de recetas'}
            </button>
          </section>
        )}

        {/* ── CERRAR SESIÓN ───────────────────────────────── */}
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
