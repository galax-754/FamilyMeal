'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        const msg = (data.error ?? '').toLowerCase()
        if (msg.includes('invalid')) {
          toast.error('Email o contraseña incorrectos. Intenta de nuevo.')
        } else {
          toast.error('Algo salió mal. Intenta de nuevo.')
        }
        return
      }

      window.location.href = '/inicio'
    } catch {
      toast.error('Sin conexión. Verifica tu internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <span className="auth-logo-icon"><UtensilsCrossed style={{ width: 40, height: 40 }} /></span>
        <h1 className="auth-logo-title">FamilyMeal</h1>
        <p className="auth-logo-subtitle">Organiza las comidas de tu familia</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-card form-stack">
        <h2 className="auth-title">Iniciar sesión</h2>

        <div className="form-field">
          <label className="form-label">Correo electrónico</label>
          <div className="input-icon-wrap">
            <Mail className="icon-left" style={{ width: 20, height: 20 }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="input input-padded-left"
              style={{ minHeight: 52 }}
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Contraseña</label>
          <div className="input-icon-wrap">
            <Lock className="icon-left" style={{ width: 20, height: 20 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="input input-padded-left input-padded-right"
              style={{ minHeight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="input-btn-right"
            >
              {showPassword ? <EyeOff style={{ width: 20, height: 20 }} /> : <Eye style={{ width: 20, height: 20 }} />}
            </button>
          </div>
        </div>

        <Button type="submit" fullWidth loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="auth-footer">
        ¿No tienes cuenta?{' '}
        <Link href="/registrar" className="auth-footer-link">
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}
