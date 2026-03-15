'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const success = useCallback((m: string) => showToast(m, 'success'), [showToast])
  const error   = useCallback((m: string) => showToast(m, 'error'), [showToast])
  const warning = useCallback((m: string) => showToast(m, 'warning'), [showToast])

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle style={{ width: 20, height: 20, color: '#4ade80', flexShrink: 0 }} />,
    error:   <XCircle     style={{ width: 20, height: 20, color: '#f87171', flexShrink: 0 }} />,
    warning: <AlertCircle style={{ width: 20, height: 20, color: '#fbbf24', flexShrink: 0 }} />,
  }

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {icons[toast.type]}
            <p className="toast-text">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="toast-close">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
