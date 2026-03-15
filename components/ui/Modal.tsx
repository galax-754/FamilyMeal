'use client'

import { useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizeClass = { sm: 'modal-sheet-sm', md: 'modal-sheet-md', lg: 'modal-sheet-lg' }[maxWidth]

  return (
    <div className="modal-backdrop">
      <div className="modal-overlay" onClick={onClose} />

      <div
        className={`modal-sheet ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle-row">
          <div className="modal-handle" />
        </div>

        {title && (
          <div className="modal-title-row">
            <h2 className="modal-heading">{title}</h2>
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Cerrar"
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        )}

        <div className="modal-body-inner">
          {children}
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  variant?: 'danger' | 'primary'
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmText = 'Confirmar', cancelText = 'Cancelar',
  loading = false, variant = 'primary',
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="sm">
      <p className="text-muted fs-14 mb-16">{message}</p>
      <div className="flex gap-12">
        <Button variant="secondary" onClick={onClose} fullWidth disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} fullWidth loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
