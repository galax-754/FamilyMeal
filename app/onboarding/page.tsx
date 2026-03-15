'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'verificando' | 'elegir' | 'crear' | 'unirse'

export default function OnboardingPage() {
  const [step, setStep]               = useState<Step>('verificando')
  const [familyName, setFamilyName]   = useState('')
  const [userName, setUserName]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [inviteCode, setInviteCode]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const router = useRouter()

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (profile?.family_id) {
        router.push('/inicio')
        return
      }
    }
    setStep('elegir')
  }

  async function crearFamilia() {
    if (!userName.trim() || !familyName.trim()) {
      setError('Completa tu nombre y el nombre de tu familia')
      return
    }
    if (!email.trim() || !password.trim()) {
      setError('Completa tu email y contraseña')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      let userId: string

      const { data: { user: existingUser } } = await supabase.auth.getUser()

      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: userName.trim() } },
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            const { data: loginData, error: loginError } =
              await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              })
            if (loginError) throw new Error('Email ya registrado con otra contraseña')
            userId = loginData.user!.id
          } else {
            throw authError
          }
        } else {
          userId = authData.user!.id
        }
      }

      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName.trim(), budget_weekly: 1000 })
        .select()
        .single()

      if (familyError) throw familyError

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: userName.trim(),
          family_id: family.id,
          role: 'admin',
          avatar_color: '#f59e0b',
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const code = Array.from({ length: 8 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('')

      await supabase
        .from('family_invitations')
        .insert({
          family_id: family.id,
          code,
          created_by: userId,
          is_active: true,
        })

      router.push('/preferencias')

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la familia')
    } finally {
      setLoading(false)
    }
  }

  async function unirseConCodigo() {
    if (!userName.trim() || !inviteCode.trim()) {
      setError('Completa tu nombre y el código de invitación')
      return
    }
    if (!email.trim() || !password.trim()) {
      setError('Completa tu email y contraseña')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const cleanCode = inviteCode.trim().toUpperCase()

      const { data: invitation } = await supabase
        .from('family_invitations')
        .select('family_id, is_active, families(name)')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle()

      if (!invitation) {
        setError('Código inválido. Pide el link correcto al administrador.')
        setLoading(false)
        return
      }

      let userId: string
      const { data: { user: existingUser } } = await supabase.auth.getUser()

      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: authData, error: authError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: userName.trim() } },
          })

        if (authError) {
          if (authError.message.includes('already registered')) {
            const { data: loginData, error: loginError } =
              await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              })
            if (loginError) throw new Error('Contraseña incorrecta')
            userId = loginData.user!.id
          } else {
            throw authError
          }
        } else {
          userId = authData.user!.id
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: userName.trim(),
          family_id: invitation.family_id,
          role: 'member',
          avatar_color: getRandomColor(),
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      const { data: current } = await supabase
        .from('family_invitations')
        .select('used_count')
        .eq('code', cleanCode)
        .single()

      await supabase
        .from('family_invitations')
        .update({ used_count: (current?.used_count || 0) + 1 })
        .eq('code', cleanCode)

      router.push('/preferencias')

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al unirse')
    } finally {
      setLoading(false)
    }
  }

  function getRandomColor() {
    const colors = ['#6366f1', '#ec4899', '#0891b2', '#059669', '#7c3aed']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  if (step === 'verificando') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: '48px' }}>🍽️</div>
      </div>
    )
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
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '52px', marginBottom: '12px' }}>🍽️</div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 900,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #f59e0b, #fde68a)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          FamilyMeal
        </h1>
      </div>

      {/* ── ELEGIR ── */}
      {step === 'elegir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            textAlign: 'center',
            marginBottom: '8px',
          }}>
            ¿Cómo quieres empezar?
          </h2>

          <div
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => { setStep('crear'); setError('') }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👑</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
              Crear mi familia
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Seré el administrador e invitaré a mi familia
            </div>
          </div>

          <div
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => { setStep('unirse'); setError('') }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔗</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
              Unirme a una familia
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Tengo un código de invitación
            </div>
          </div>
        </div>
      )}

      {/* ── CREAR FAMILIA ── */}
      {step === 'crear' && (
        <div>
          <button
            onClick={() => { setStep('elegir'); setError('') }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--amber)', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
              marginBottom: '20px', padding: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            ← Volver
          </button>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '20px' }}>
            Crear mi familia
          </h2>

          <div className="field-group">
            <label className="field-label">Tu nombre</label>
            <input type="text" className="input"
              placeholder="Ej: Kareny"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label className="field-label">Nombre de tu familia</label>
            <input type="text" className="input"
              placeholder="Ej: Familia Garza"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Tu email</label>
            <input type="email" className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field-group" style={{ marginBottom: '24px' }}>
            <label className="field-label">Contraseña</label>
            <input type="password" className="input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          <button className="btn-primary" onClick={crearFamilia} disabled={loading}>
            {loading ? 'Creando familia...' : 'Crear familia →'}
          </button>
        </div>
      )}

      {/* ── UNIRSE ── */}
      {step === 'unirse' && (
        <div>
          <button
            onClick={() => { setStep('elegir'); setError('') }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--amber)', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
              marginBottom: '20px', padding: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            ← Volver
          </button>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
            Unirme a una familia
          </h2>

          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Ingresa el código del link que te compartieron.
            Es la parte después de &ldquo;?codigo=&rdquo; en el link.
          </p>

          <div className="field-group">
            <label className="field-label">Tu nombre</label>
            <input type="text" className="input"
              placeholder="Ej: Mamá, Papá..."
              value={userName}
              onChange={e => setUserName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label className="field-label">Código de invitación</label>
            <input type="text" className="input"
              placeholder="Ej: AB3D7XYZ"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Tu email</label>
            <input type="email" className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field-group" style={{ marginBottom: '24px' }}>
            <label className="field-label">Contraseña</label>
            <input type="password" className="input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          <button className="btn-primary" onClick={unirseConCodigo} disabled={loading}>
            {loading ? 'Uniéndome...' : 'Unirme a la familia →'}
          </button>
        </div>
      )}
    </div>
  )
}
