'use client'

import React from 'react'
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorMessageProps {
  type?: 'network' | 'generic' | 'notfound'
  message?: string
  onRetry?: () => void
}

export function ErrorMessage({ type = 'generic', message, onRetry }: ErrorMessageProps) {
  const configs = {
    network: {
      icon: <WifiOff style={{ width: 40, height: 40, color: 'var(--muted)' }} />,
      title: 'Sin conexión',
      text: 'Verifica tu conexión a internet.',
    },
    generic: {
      icon: <RefreshCw style={{ width: 40, height: 40, color: 'var(--muted)' }} />,
      title: 'Algo salió mal',
      text: 'Intenta de nuevo.',
    },
    notfound: {
      icon: <AlertTriangle style={{ width: 40, height: 40, color: 'var(--muted)' }} />,
      title: 'No encontrado',
      text: 'Este elemento no existe o fue eliminado.',
    },
  }

  const cfg = configs[type]

  return (
    <div className="error-center">
      {cfg.icon}
      <div>
        <p className="error-title">{cfg.title}</p>
        <p className="error-text">{message ?? cfg.text}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} size="sm">
          Reintentar
        </Button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="error-center">
      {icon && <span style={{ color: 'var(--muted)' }}>{icon}</span>}
      <div>
        <p className="error-title">{title}</p>
        {description && <p className="error-text">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-8">
          {action.label}
        </Button>
      )}
    </div>
  )
}
