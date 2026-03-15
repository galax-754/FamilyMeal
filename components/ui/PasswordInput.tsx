'use client'
import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Contraseña',
  className = '',
  autoFocus = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={show ? 'text' : 'password'}
        className={`input ${className}`.trim()}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        style={{ paddingRight: '48px' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
              a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4
              c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07
              a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        )}
      </button>
    </div>
  )
}
