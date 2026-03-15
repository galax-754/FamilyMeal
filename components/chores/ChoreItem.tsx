'use client'

import { useState } from 'react'
import { Calendar, User, Check, Trash2 } from 'lucide-react'
import { Chore } from '@/types'

interface ChoreItemProps {
  chore: Chore
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ChoreItem({ chore, onToggle, onDelete }: ChoreItemProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      await onToggle(chore.id, !chore.completed)
    } finally {
      setLoading(false)
    }
  }

  const isOverdue =
    !chore.completed &&
    chore.due_date &&
    new Date(chore.due_date) < new Date(new Date().toDateString())

  return (
    <div className={`chore-item${chore.completed ? ' done' : ''}${isOverdue ? ' overdue' : ''}`}>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`chore-toggle-btn${chore.completed ? ' checked' : ''}`}
      >
        {chore.completed && <Check style={{ width: 14, height: 14, color: '#fff' }} strokeWidth={3} />}
      </button>

      <div className="chore-content">
        <p className={`chore-title${chore.completed ? ' chore-title-done' : ''}`}>
          {chore.title}
        </p>

        <div className="chore-meta-row">
          {chore.assignee && (
            <span className="chore-meta-item">
              <User style={{ width: 14, height: 14 }} />
              {chore.assignee.name}
            </span>
          )}
          {chore.due_date && (
            <span className={`chore-meta-item${isOverdue ? ' chore-meta-overdue' : ''}`}>
              <Calendar style={{ width: 14, height: 14 }} />
              {new Date(chore.due_date + 'T00:00:00').toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
              })}
              {isOverdue && ' — Vencida'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(chore.id)}
        className="chore-delete-btn"
      >
        <Trash2 style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}
