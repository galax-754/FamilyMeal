import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />
}

export function MealCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-h-full" />
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-h5 skeleton-w-3-4" />
        <div className="skeleton skeleton-h4 skeleton-w-1-2" />
        <div className="flex gap-8 mt-8">
          <div className="skeleton skeleton-h4 skeleton-w-20 skeleton-pill" />
          <div className="skeleton skeleton-h4 skeleton-w-16 skeleton-pill" />
        </div>
      </div>
    </div>
  )
}

export function ChoreItemSkeleton() {
  return (
    <div className="skeleton-row">
      <div className="skeleton skeleton-w-6" />
      <div className="skeleton-row-content">
        <div className="skeleton skeleton-h4 skeleton-w-3-4" />
        <div className="skeleton skeleton-h4 skeleton-w-1-2" style={{ height: 12 }} />
      </div>
    </div>
  )
}

export function MenuGridSkeleton() {
  return (
    <div className="stack-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-card-body">
            <div className="skeleton skeleton-h4 skeleton-w-20" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="skeleton skeleton-h10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageLoader({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="error-center">
      <div className="spinner spinner-lg" />
      <p className="text-muted fs-14">{message}</p>
    </div>
  )
}
