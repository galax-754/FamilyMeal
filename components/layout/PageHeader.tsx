'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  backHref?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, back, backHref, action }: PageHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <header className="page-header">
      <div className="page-header-inner">
        {back && (
          <button
            onClick={handleBack}
            className="btn-back"
            aria-label="Volver"
          >
            <ChevronLeft style={{ width: 24, height: 24 }} />
          </button>
        )}

        <div className="page-header-content">
          <h1 className="page-header-title">{title}</h1>
          {subtitle && (
            <p className="page-header-subtitle">{subtitle}</p>
          )}
        </div>

        {action && (
          <div className="page-header-action">{action}</div>
        )}
      </div>
    </header>
  )
}
