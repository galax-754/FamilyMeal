'use client'

interface NotificacionModalProps {
  adminName: string
  familyName: string
  onContinuar: () => void
}

export function NotificacionModal({
  adminName,
  familyName,
  onContinuar,
}: NotificacionModalProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-med)',
        borderRadius: '24px',
        padding: '32px 24px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        animation: 'slideUp 0.3s ease',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'var(--amber-soft)',
          border: '2px solid rgba(245,158,11,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '32px',
        }}>
          📋
        </div>

        <h2 style={{
          fontSize: '20px',
          fontWeight: 800,
          color: 'var(--text)',
          marginBottom: '12px',
          letterSpacing: '-0.3px',
        }}>
          ¡Hola! Te necesitamos 👋
        </h2>

        <p style={{
          fontSize: '14px',
          color: 'var(--muted)',
          lineHeight: 1.6,
          marginBottom: '8px',
        }}>
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{adminName}</span>
          {' '}te ha notificado para configurar tus preferencias de alimentos en{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{familyName}</span>.
        </p>

        <p style={{
          fontSize: '13px',
          color: 'var(--muted)',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}>
          Solo toma 2 minutos. Cuéntanos qué te gusta comer,
          qué no te gusta y si tienes alguna restricción.
        </p>

        <div style={{
          background: 'var(--surface2)',
          borderRadius: 'var(--r-sm)',
          padding: '12px 16px',
          marginBottom: '24px',
          textAlign: 'left',
        }}>
          {[
            '✅ Qué tipo de comida te gusta',
            '❌ Qué no quieres comer',
            '⚠️ Alergias o restricciones',
            '🩺 Condiciones de salud',
          ].map((item, i) => (
            <div key={i} style={{
              fontSize: '13px',
              color: 'var(--muted)',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {item}
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={onContinuar}>
          Empezar ahora →
        </button>
      </div>
    </div>
  )
}
