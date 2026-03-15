'use client'

import { useState } from 'react'
import { Plus, LogIn, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

interface FamilySetupProps {
  userId: string
  onComplete: () => void
}

export function FamilySetup({ userId, onComplete }: FamilySetupProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const supabase = createClient()

  const createFamily = async () => {
    if (!familyName.trim()) return
    setLoading(true)
    try {
      const { data: family, error: fErr } = await supabase
        .from('families')
        .insert({ name: familyName.trim() })
        .select()
        .single()

      if (fErr) throw fErr

      const { error: pErr } = await supabase
        .from('profiles')
        .update({ family_id: family.id, role: 'admin' })
        .eq('id', userId)

      if (pErr) throw pErr

      toast.success(`Familia "${family.name}" creada correctamente`)
      onComplete()
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const joinFamily = async () => {
    if (!inviteCode.trim()) return
    setLoading(true)
    try {
      const { data: family, error: fErr } = await supabase
        .from('families')
        .select()
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .single()

      if (fErr || !family) {
        toast.error('Código de invitación inválido. Verifica e intenta de nuevo.')
        return
      }

      const { error: pErr } = await supabase
        .from('profiles')
        .update({ family_id: family.id, role: 'member' })
        .eq('id', userId)

      if (pErr) throw pErr

      toast.success(`Te uniste a "${family.name}" correctamente`)
      onComplete()
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <span className="auth-logo-icon"><Users style={{ width: 40, height: 40 }} /></span>
        <h1 className="auth-logo-title">¡Bienvenido!</h1>
        <p className="auth-logo-subtitle">Para empezar, crea o únete a una familia</p>
      </div>

      <div className="auth-card">
        {mode === 'choose' && (
          <div className="stack-3">
            <Button
              fullWidth
              onClick={() => setMode('create')}
              icon={<Plus style={{ width: 20, height: 20 }} />}
            >
              Crear nueva familia
            </Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => setMode('join')}
              icon={<LogIn style={{ width: 20, height: 20 }} />}
            >
              Unirme con código
            </Button>
          </div>
        )}

        {mode === 'create' && (
          <div className="stack-4">
            <div className="form-field">
              <label className="form-label">Nombre de tu familia</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Ej. Familia García"
                className="input"
                autoFocus
              />
            </div>
            <Button fullWidth onClick={createFamily} loading={loading} disabled={!familyName.trim()}>
              Crear familia
            </Button>
            <button onClick={() => setMode('choose')} className="btn-toggle-completed w-full justify-center">
              Volver
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="stack-4">
            <div className="form-field">
              <label className="form-label">Código de invitación</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Ej. a1b2c3d4"
                maxLength={8}
                className="input text-center"
                style={{ fontFamily: 'monospace', letterSpacing: '4px', textTransform: 'uppercase' }}
                autoFocus
              />
            </div>
            <Button fullWidth onClick={joinFamily} loading={loading} disabled={!inviteCode.trim()}>
              Unirme
            </Button>
            <button onClick={() => setMode('choose')} className="btn-toggle-completed w-full justify-center">
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
