'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'elegir' | 'crear' | 'unirse'

export default function OnboardingPage() {
  const [step, setStep]           = useState<Step>('elegir')
  const [familyName, setFamilyName] = useState('')
  const [userName, setUserName]   = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const router = useRouter()

  async function crearFamilia() {
    if (!familyName.trim() || !userName.trim()) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName.trim(), budget_weekly: 1000 })
        .select()
        .single()

      if (familyError) throw familyError

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id:        user.id,
          name:      userName.trim(),
          family_id: family.id,
          role:      'admin',
        })

      if (profileError) throw profileError

      router.push('/preferencias')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la familia')
    } finally {
      setLoading(false)
    }
  }

  async function unirseAFamilia() {
    if (!inviteCode.trim() || !userName.trim()) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Buscar familia por invite_code (igual que la página /unirse)
      const { data: family } = await supabase
        .from('families')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .single()

      if (!family) {
        setError('Código inválido. Pide el link correcto a tu familia.')
        setLoading(false)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id:        user.id,
          name:      userName.trim(),
          family_id: family.id,
          role:      'member',
        })

      if (profileError) throw profileError

      router.push('/preferencias')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al unirse a la familia')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('elegir')
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '32px 20px',
      maxWidth: '430px',
      margin: '0 auto',
    }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #f59e0b, #fde68a)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          FamilyMeal
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          Organiza las comidas de tu familia
        </p>
      </div>

      {/* ── PASO: Elegir ────────────────────────── */}
      {step === 'elegir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            ¿Cómo quieres empezar?
          </h2>

          <div
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setStep('crear')}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>👑</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Crear mi familia
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Soy el administrador. Invitaré a mi familia después.
            </div>
          </div>

          <div
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setStep('unirse')}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Unirme a una familia
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Tengo un link de invitación de mi familia.
            </div>
          </div>
        </div>
      )}

      {/* ── PASO: Crear familia ─────────────────── */}
      {step === 'crear' && (
        <div>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--amber)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 20,
              padding: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            ← Volver
          </button>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>
            Crear mi familia
          </h2>

          <div className="field-group">
            <label className="field-label">Tu nombre</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Kareny"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-group" style={{ marginBottom: 24 }}>
            <label className="field-label">Nombre de tu familia</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Familia Garza"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <button
            className="btn-primary"
            onClick={crearFamilia}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Creando familia...' : 'Crear familia →'}
          </button>
        </div>
      )}

      {/* ── PASO: Unirse ────────────────────────── */}
      {step === 'unirse' && (
        <div>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--amber)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 20,
              padding: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            ← Volver
          </button>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Unirme a una familia
          </h2>

          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Pega el código del link que te mandaron.
            Es la parte después de <strong style={{ color: 'var(--text)' }}>?codigo=</strong>
          </p>

          <div className="field-group">
            <label className="field-label">Tu nombre</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Mamá"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-group" style={{ marginBottom: 24 }}>
            <label className="field-label">Código de invitación</label>
            <input
              type="text"
              className="input"
              placeholder="Pega el código aquí"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <button
            className="btn-primary"
            onClick={unirseAFamilia}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Uniéndome...' : 'Unirme a la familia →'}
          </button>
        </div>
      )}
    </div>
  )
}
