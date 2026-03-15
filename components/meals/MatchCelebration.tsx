'use client'
import { useEffect, useRef, useState } from 'react'

interface MatchCelebrationProps {
  meal: {
    name: string
    category: string
    image_url?: string
    assignedDay?: number
  }
  onClose: () => void
}

const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ffffff']

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function MatchCelebration({ meal, onClose }: MatchCelebrationProps) {
  const [visible, setVisible] = useState(true)

  // Pre-generate confetti positions once to avoid hydration mismatch
  const confetti = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      left: `${(i / 20) * 100 + Math.sin(i) * 3}%`,
      delay: `${(i % 5) * 0.12}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      isCircle: i % 2 === 0,
      duration: `${1.5 + (i % 3) * 0.4}s`,
    }))
  ).current

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        padding: '20px',
      }}
    >
      {/* Confetti animado */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        {confetti.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              borderRadius: c.isCircle ? '50%' : '2px',
              background: c.color,
              left: c.left,
              top: '-10px',
              animation: `confettiFall ${c.duration} ease-in ${c.delay} forwards`,
            }}
          />
        ))}
      </div>

      {/* Card de match */}
      <div style={{
        background: 'var(--surface)',
        border: '2px solid rgba(245,158,11,0.4)',
        borderRadius: '24px',
        padding: '32px 24px',
        maxWidth: '360px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        animation: 'matchPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
      }}>
        <div style={{
          fontSize: '72px',
          marginBottom: '16px',
          animation: 'bounce 0.6s ease infinite alternate',
        }}>
          🎉
        </div>

        <div style={{
          fontSize: '22px',
          fontWeight: 900,
          color: 'var(--amber)',
          marginBottom: '6px',
          letterSpacing: '-0.3px',
        }}>
          ¡Match!
        </div>

        <div style={{
          fontSize: '14px',
          color: 'var(--muted)',
          marginBottom: '20px',
        }}>
          ¡A todos les gustó!
        </div>

        {meal.image_url && (
          <div style={{
            width: '100%',
            height: '140px',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            <img
              src={meal.image_url}
              alt={meal.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{
          fontSize: '16px',
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: '12px',
          lineHeight: 1.3,
        }}>
          {meal.name}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            background: 'rgba(245,158,11,0.15)',
            color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {meal.category}
          </span>
          {meal.assignedDay && (
            <span style={{
              background: 'rgba(16,185,129,0.15)',
              color: 'var(--green)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              📅 {DAYS[meal.assignedDay]}
            </span>
          )}
        </div>

        {/* Barra de progreso que se cierra */}
        <div style={{
          height: '3px',
          background: 'var(--surface2)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'var(--amber)',
            borderRadius: '3px',
            animation: 'shrink 3s linear forwards',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes matchPop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0% { transform: translateY(0) rotate(-5deg); }
          100% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes shrink {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  )
}
