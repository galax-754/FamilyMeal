'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function UserMenu() {
  const [open, setOpen]       = useState(false)
  const [userName, setUserName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          (user.user_metadata?.name as string | undefined) ||
          user.email?.split('@')[0] ||
          'Usuario'
        setUserName(name)
      }
    })
  }, [])

  async function signOut() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!userName) return null

  const initial = userName.charAt(0).toUpperCase()

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 700,
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Overlay para cerrar al tocar fuera */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />

          <div style={{
            position: 'absolute',
            top: 44,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border-med)',
            borderRadius: 'var(--r-sm)',
            padding: 8,
            minWidth: 164,
            zIndex: 99,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}>
            {/* Nombre */}
            <div style={{
              padding: '8px 10px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              borderBottom: '1px solid var(--border)',
              marginBottom: 4,
            }}>
              {userName}
            </div>

            {/* Cerrar sesión */}
            <button
              onClick={signOut}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--red)',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 'var(--r-xs)',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
