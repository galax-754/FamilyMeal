'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, User, Eye, EyeOff, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function RegistrarPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      if (!res.ok) {
        const data = await res.json()
        const msg = (data.error ?? '').toLowerCase()
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          toast.error('Este correo ya está registrado. Intenta iniciar sesión.')
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
        <span className="auth-logo-icon"><Users style={{ width: 40, height: 40 }} /></span>
        <h1 className="auth-logo-title">Crea tu cuenta</h1>
        <p className="auth-logo-subtitle">Es gratis, tarda 30 segundos</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-card form-stack">
        <div className="form-field">
          <label className="form-label">Tu nombre</label>
          <div className="input-icon-wrap">
            <User className="icon-left" style={{ width: 20, height: 20 }} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Carlos"
              required
              autoComplete="name"
              className="input input-padded-left"
              style={{ minHeight: 52 }}
            />
          </div>
        </div>

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
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
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
          Crear cuenta gratis
        </Button>
      </form>

      <p className="auth-footer">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="auth-footer-link">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
