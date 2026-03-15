'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

interface FamilyInfo {
  id: string
  name: string
}

function UnirseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  const codigo = searchParams.get('codigo') ?? ''

  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [mode, setMode] = useState<'register' | 'login'>('register')

  // Campos del form
  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      if (codigo) {
        const cleanCode = codigo.trim().toUpperCase()
        const { data: inv } = await supabase
          .from('family_invitations')
          .select('family_id, is_active, families(id, name)')
          .eq('code', cleanCode)
          .eq('is_active', true)
          .maybeSingle()

        if (inv?.families) {
          const fam = inv.families as unknown as FamilyInfo
          setFamily(fam)
        }
      }
      setLoading(false)
    }
    init()
  }, [codigo])

  const joinFamily = async (userId: string) => {
    if (!family) return
    const cleanCode = codigo.trim().toUpperCase()

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, family_id: family.id, role: 'member' }, { onConflict: 'id' })
    if (error) throw error

    const { data: current } = await supabase
      .from('family_invitations')
      .select('used_count')
      .eq('code', cleanCode)
      .single()

    await supabase
      .from('family_invitations')
      .update({ used_count: (current?.used_count || 0) + 1 })
      .eq('code', cleanCode)

    toast.success(`¡Te uniste a ${family.name}!`)
    router.push('/preferencias')
  }

  const handleRegister = async () => {
    if (!nombre.trim() || !email.trim() || password.length < 6) return
    setJoining(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: nombre.trim() } },
      })
      if (error) throw error
      if (data.user) {
        // Dar tiempo al trigger de perfil
        await new Promise((r) => setTimeout(r, 1200))
        await joinFamily(data.user.id)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Algo salió mal. Intenta de nuevo.'
      toast.error(msg)
    } finally {
      setJoining(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setJoining(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      if (data.user) await joinFamily(data.user.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credenciales inválidas.'
      toast.error(msg)
    } finally {
      setJoining(false)
    }
  }

  const handleJoinLoggedIn = async () => {
    if (!currentUserId) return
    setJoining(true)
    try {
      await joinFamily(currentUserId)
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-logo">
          <span className="auth-logo-icon">🍽️</span>
          <h1 className="auth-logo-title">FamilyMeal</h1>
          <p className="auth-logo-subtitle">Cargando...</p>
        </div>
        <div className="auth-card" style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Loader2 style={{ width: 28, height: 28, color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    )
  }

  if (!family) {
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

  return (
    <div className="auth-page">
      {/* Banner de familia */}
      <div className="auth-logo">
        <span className="auth-logo-icon"><Users style={{ width: 40, height: 40 }} /></span>
        <h1 className="auth-logo-title">¡Te invitaron!</h1>
        <p className="auth-logo-subtitle">
          Únete a{' '}
          <strong style={{ color: 'var(--amber)' }}>{family.name}</strong>
          {' '}en FamilyMeal
        </p>
      </div>

      <div className="auth-card">
        {/* Usuario YA autenticado */}
        {currentUserId ? (
          <div className="stack-3">
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
              Serás miembro de <strong style={{ color: 'var(--text)' }}>{family.name}</strong>
            </p>
            <Button
              fullWidth
              onClick={handleJoinLoggedIn}
              loading={joining}
              icon={<ArrowRight style={{ width: 18, height: 18 }} />}
            >
              Unirme a {family.name}
            </Button>
          </div>
        ) : (
          <>
            {/* ── REGISTRO ─────────────────────────────── */}
            {mode === 'register' && (
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
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. María"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input"
                  />
                </div>

                <Button
                  fullWidth
                  onClick={handleRegister}
                  loading={joining}
                  disabled={!nombre.trim() || !email.trim() || password.length < 6}
                >
                  Crear cuenta y unirme
                </Button>

                <p className="auth-footer">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="auth-footer-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                  >
                    Iniciar sesión
                  </button>
                </p>
              </div>
            )}

            {/* ── LOGIN ─────────────────────────────────── */}
            {mode === 'login' && (
              <div className="stack-4">
                <div>
                  <h2 className="auth-title">Iniciar sesión y unirme</h2>
                </div>

                <div className="form-field">
                  <label className="form-label">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="input"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="input"
                  />
                </div>

                <Button
                  fullWidth
                  onClick={handleLogin}
                  loading={joining}
                  disabled={!email.trim() || !password}
                >
                  Iniciar sesión y unirme
                </Button>

                <p className="auth-footer">
                  ¿No tienes cuenta?{' '}
                  <button
                    onClick={() => setMode('register')}
                    className="auth-footer-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                  >
                    Crear cuenta
                  </button>
                </p>
              </div>
            )}
          </>
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
