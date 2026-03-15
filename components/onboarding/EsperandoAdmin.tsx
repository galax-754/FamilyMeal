'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getWeekNumber } from '@/lib/votes'

interface EsperandoAdminProps {
  familyId: string
  adminName: string
  memberName: string
  onRecetasListas: () => void
}

export function EsperandoAdmin({
  familyId,
  adminName,
  memberName,
  onRecetasListas,
}: EsperandoAdminProps) {
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => prev >= 3 ? 1 : prev + 1)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const weekNumber = getWeekNumber(new Date())
      const year = new Date().getFullYear()

      const { data } = await supabase
        .from('weekly_voting_status')
        .select('recipes_generated')
        .eq('family_id', familyId)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .maybeSingle()

      if (data?.recipes_generated) {
        onRecetasListas()
      }
    }

    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [familyId, onRecetasListas])

  const dots = '.'.repeat(dotCount)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      maxWidth: '430px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🍽️</div>

      <h2 style={{
        fontSize: '22px',
        fontWeight: 800,
        color: 'var(--text)',
        marginBottom: '8px',
        letterSpacing: '-0.3px',
      }}>
        ¡Listo, {memberName}!
      </h2>

      <p style={{
        fontSize: '14px',
        color: 'var(--muted)',
        lineHeight: 1.6,
        marginBottom: '32px',
      }}>
        Tus preferencias fueron guardadas.
        Esperando a{' '}
        <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{adminName}</span>
        {' '}para que genere el menú de la semana{dots}
      </p>

      <div style={{ width: '100%', maxWidth: '280px', marginBottom: '32px' }}>
        <div style={{
          height: '4px',
          background: 'var(--surface2)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, var(--amber), var(--amber-dark, #d97706))',
            animation: 'loadingBar 2s ease-in-out infinite',
          }} />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
          Te avisaremos cuando sea hora de votar
        </p>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '16px 20px',
        width: '100%',
        textAlign: 'left',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '10px',
        }}>
          ¿Qué sigue?
        </div>
        {[
          { emoji: '✨', text: `${adminName} generará recetas personalizadas para toda la familia` },
          { emoji: '👆', text: 'Votarás las recetas deslizando a la derecha o izquierda' },
          { emoji: '❤️', text: 'Cuando coincidan los gustos se formarán los matches del menú' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '10px',
            padding: '6px 0',
            borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.emoji}</span>
            <span style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes loadingBar {
          0%   { width: 0%;   margin-left: 0%;    }
          50%  { width: 60%;  margin-left: 20%;   }
          100% { width: 0%;   margin-left: 100%;  }
        }
      `}</style>
    </div>
  )
}
