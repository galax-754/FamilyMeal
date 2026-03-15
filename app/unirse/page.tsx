'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Step = 'verificando' | 'error' | 'registro'

function UnirseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const codigo = searchParams.get('codigo') ?? ''

  const [step, setStep]           = useState<Step>('verificando')
  const [familyName, setFamilyName] = useState('')
  const [familyId, setFamilyId]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [mode, setMode]           = useState<'register' | 'login'>('register')

  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (codigo) {
      validarCodigo(codigo)
    } else {
      setStep('error')
    }
  }, [codigo])

  async function validarCodigo(code: string) {
    const supabase = createClient()
    const cleanCode = code.trim().toUpperCase()

    try {
      const { data: invitation, error: invError } = await supabase
        .from('family_invitations')
        .select(`
          family_id,
          is_active,
          code,
          families (
            id,
            name
          )
        `)
        .ilike('code', cleanCode)
        .maybeSingle()

      if (invError) {
        console.error('[unirse] Error Supabase:', invError)
        setStep('error')
        return
      }

      if (!invitation || !invitation.is_active) {
        setStep('error')
        return
      }

      const family = Array.isArray(invitation.families)
        ? invitation.families[0]
        : invitation.families

      setFamilyName((family as { name: string } | null)?.name || 'tu familia')
      setFamilyId(invitation.family_id)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await unirseDirecto(user.id, invitation.family_id, cleanCode)
      } else {
        setStep('registro')
      }
    } catch (err) {
      console.error('[unirse] Error inesperado:', err)
      setStep('error')
    }
  }

  async function unirseDirecto(userId: string, famId: string, code: string) {
    const supabase = createClient()
    const cleanCode = code.trim().toUpperCase()

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, family_id: famId, role: 'member' }, { onConflict: 'id' })

    if (!error) {
      const { data: current } = await supabase
        .from('family_invitations')
        .select('used_count')
        .ilike('code', cleanCode)
        .single()

      await supabase
        .from('family_invitations')
        .update({ used_count: (current?.used_count || 0) + 1 })
        .ilike('code', cleanCode)

      router.push('/preferencias')
    }
  }

  async function handleRegister() {
    if (!nombre.trim() || !email.trim() || password.length < 6) {
      setError('Completa todos los campos (contraseña mínimo 6 caracteres)')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: nombre.trim() } },
      })
      if (authError) throw authError
      if (data.user) {
        await unirseDirecto(data.user.id, familyId, codigo)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Completa el email y la contraseña')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) throw authError
      if (data.user) await unirseDirecto(data.user.id, familyId, codigo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  // ── Verificando ──
  if (step === 'verificando') {
    return (
      <div className="auth-page">
        <div className="auth-logo">
          <span className="auth-logo-icon">🍽️</span>
          <h1 className="auth-logo-title">FamilyMeal</h1>
          <p className="auth-logo-subtitle">Validando invitación...</p>
        </div>
        <div className="auth-card" style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Loader2 style={{ width: 28, height: 28, color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    )
  }

  // ── Error ──
  if (step === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-logo">
          <span className="auth-logo-icon">❌</span>
          <h1 className="auth-logo-title">Link inválido</h1>
          <p className="auth-logo-subtitle">
            Este link de invitación no existe o ya no está activo
          </p>
        </div>
        <div className="auth-card">
          <Link
            href="/login"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '14px',
              background: 'var(--amber)',
              color: '#000',
              borderRadius: 'var(--r-sm)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  // ── Registro / Login ──
  return (
    <div className="auth-page">
      <div className="auth-logo">
        <span className="auth-logo-icon">
          <Users style={{ width: 40, height: 40 }} />
        </span>
        <h1 className="auth-logo-title">¡Te invitaron!</h1>
        <p className="auth-logo-subtitle">
          Únete a{' '}
          <strong style={{ color: 'var(--amber)' }}>{familyName}</strong>
          {' '}en FamilyMeal
        </p>
      </div>

      <div className="auth-card">
        {mode === 'register' ? (
          <div className="stack-4">
            <div>
              <h2 className="auth-title">Crear cuenta y unirme</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Crea tu cuenta para unirte a la familia
              </p>
            </div>

            <div className="form-field">
              <label className="form-label">Tu nombre</label>
              <input
                type="text" value={nombre} className="input" autoFocus
                placeholder="Ej. María"
                onChange={e => setNombre(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email" value={email} className="input"
                placeholder="tu@correo.com"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Contraseña</label>
              <input
                type="password" value={password} className="input"
                placeholder="Mínimo 6 caracteres"
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p style={{ color: 'var(--red, #ef4444)', fontSize: 13 }}>{error}</p>}

            <button
              className="btn-primary"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta y unirme →'}
            </button>

            <p className="auth-footer">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => { setMode('login'); setError('') }}
                className="auth-footer-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
              >
                Iniciar sesión
              </button>
            </p>
          </div>
        ) : (
          <div className="stack-4">
            <h2 className="auth-title">Iniciar sesión y unirme</h2>

            <div className="form-field">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email" value={email} className="input" autoFocus
                placeholder="tu@correo.com"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Contraseña</label>
              <input
                type="password" value={password} className="input"
                placeholder="Tu contraseña"
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p style={{ color: 'var(--red, #ef4444)', fontSize: 13 }}>{error}</p>}

            <button
              className="btn-primary"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión y unirme →'}
            </button>

            <p className="auth-footer">
              ¿No tienes cuenta?{' '}
              <button
                onClick={() => { setMode('register'); setError('') }}
                className="auth-footer-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
              >
                Crear cuenta
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UnirsePage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-logo">
            <span className="auth-logo-icon">🍽️</span>
            <h1 className="auth-logo-title">FamilyMeal</h1>
          </div>
        </div>
      }
    >
      <UnirseContent />
    </Suspense>
  )
}
