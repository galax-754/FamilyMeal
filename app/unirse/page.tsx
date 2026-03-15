'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/PasswordInput'

type Step = 'verificando' | 'error' | 'registro'

const AVATAR_COLORS = ['av-amber', 'av-pink', 'av-indigo', 'av-green']
function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

function UnirseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const codigo = searchParams.get('codigo') ?? ''

  const [step, setStep]             = useState<Step>('verificando')
  const [familyName, setFamilyName] = useState('')
  const [familyId, setFamilyId]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [mode, setMode]             = useState<'register' | 'login'>('register')

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
        .select('family_id, is_active, code, families(id, name)')
        .ilike('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle()

      console.log('Invitación completa:', JSON.stringify(invitation))

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
      console.log('Family ID establecido:', invitation.family_id)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await asignarFamilia(user.id, '', invitation.family_id)
      } else {
        setStep('registro')
      }
    } catch (err) {
      console.error('[unirse] Error inesperado:', err)
      setStep('error')
    }
  }

  // Función centralizada que asigna la familia al usuario y redirige
  async function asignarFamilia(
    userId: string,
    displayName: string,
    overrideFamilyId?: string,
  ) {
    const supabase  = createClient()
    const famId     = overrideFamilyId || familyId
    const cleanCode = codigo?.trim().toUpperCase()

    console.log('Asignando familia:', famId, 'a usuario:', userId)

    if (!famId) {
      setError('Error: no se encontró el ID de la familia')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id:           userId,
          name:         displayName || nombre.trim() || undefined,
          family_id:    famId,
          role:         'member',
          avatar_color: getRandomColor(),
        },
        { onConflict: 'id', ignoreDuplicates: false }
      )

    console.log('Profile upsert error:', profileError)

    if (profileError) {
      setError('Error al unirse a la familia: ' + profileError.message)
      setLoading(false)
      return
    }

    // Incrementar uso de invitación
    if (cleanCode) {
      const { data: current } = await supabase
        .from('family_invitations')
        .select('used_count')
        .eq('code', cleanCode)
        .single()

      await supabase
        .from('family_invitations')
        .update({ used_count: (current?.used_count || 0) + 1 })
        .eq('code', cleanCode)
    }

    router.push('/preferencias')
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: nombre.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        // Email ya registrado — intentar login con las credenciales dadas
        if (
          authError.message.includes('already registered') ||
          authError.message.includes('already been registered')
        ) {
          const { data: loginData, error: loginError } =
            await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            })

          if (loginError) {
            setError('Este email ya tiene cuenta. Verifica tu contraseña o usa "Ya tengo cuenta".')
            setLoading(false)
            return
          }

          await asignarFamilia(loginData.user.id, nombre.trim())
          return
        }

        setError(authError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        await asignarFamilia(authData.user.id, nombre.trim())
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
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

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    if (loginError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    await asignarFamilia(data.user.id, nombre.trim())
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
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && <p style={{ color: 'var(--red, #ef4444)', fontSize: 13 }}>{error}</p>}

            <button
              className="btn-primary"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Crear cuenta y unirme →'}
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
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Tu contraseña"
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
