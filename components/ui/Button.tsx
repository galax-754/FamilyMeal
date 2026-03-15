'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:   'btn-v-primary',
    secondary: 'btn-v-secondary',
    danger:    'btn-v-danger',
    ghost:     'btn-v-ghost',
    outline:   'btn-v-outline',
  }

  const sizes: Record<string, string> = {
    sm:   'btn-sz-sm',
    md:   'btn-sz-md',
    lg:   'btn-sz-lg',
    icon: 'btn-sz-icon',
  }

  return (
    <button
      className={cn(
        'btn-base',
        variants[variant],
        sizes[size],
        fullWidth && 'btn-full',
        loading && 'btn-loading',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 style={{ width: 20, height: 20, animation: 'spin 0.6s linear infinite' }} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
