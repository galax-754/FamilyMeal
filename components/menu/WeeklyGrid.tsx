'use client'

import { useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Shuffle, Sunrise, Sun, Moon, Utensils, type LucideIcon } from 'lucide-react'
import { WeeklyMenu, Meal, MealType } from '@/types'
import { DIAS_CORTOS, MEAL_TYPES, getWeekStart, formatWeekRange, toDateString } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'

interface WeeklyGridProps {
  entries: WeeklyMenu[]
  meals: Meal[]
  weekStart: Date
  onWeekChange: (date: Date) => void
  onAssign: (dayOfWeek: number, mealType: MealType, mealId: string) => Promise<void>
  onRemove: (entryId: string) => Promise<void>
  onShuffle: () => void
  loadingSlot?: string
}

export function WeeklyGrid({
  entries, meals, weekStart, onWeekChange, onAssign, onRemove, onShuffle, loadingSlot,
}: WeeklyGridProps) {
  const [selecting, setSelecting] = useState<{ day: number; type: MealType } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const MEAL_ICONS: Record<string, LucideIcon> = { Sunrise, Sun, Moon }

  const getEntry = (day: number, type: MealType) =>
    entries.find((e) => e.day_of_week === day && e.meal_type === type)

  const handleAssign = async (mealId: string) => {
    if (!selecting) return
    await onAssign(selecting.day, selecting.type, mealId)
    setSelecting(null)
    setSearchQuery('')
  }

  const filteredMeals = meals.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    onWeekChange(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    onWeekChange(d)
  }

  const isCurrentWeek = toDateString(getWeekStart()) === toDateString(weekStart)

  return (
    <div className="stack-4">
      <div className="week-header-box">
        <button onClick={prevWeek} className="week-nav-btn">
          <ChevronLeft style={{ width: 20, height: 20 }} />
        </button>
        <div className="week-label">
          {isCurrentWeek && <span className="week-current">Esta semana</span>}
          <p className="week-range">{formatWeekRange(weekStart)}</p>
        </div>
        <button onClick={nextWeek} className="week-nav-btn">
          <ChevronRight style={{ width: 20, height: 20 }} />
        </button>
      </div>

      <button onClick={onShuffle} className="btn-primary">
        <Shuffle style={{ width: 20, height: 20 }} />
        Sortear menú de la semana
      </button>

      <div className="weekly-grid-stack">
        {DIAS_CORTOS.map((dia, dayIdx) => (
          <div key={dayIdx} className="day-block">
            <div className="day-block-header">{dia}</div>
            <div>
              {MEAL_TYPES.map(({ key, label, iconKey }) => {
                const entry = getEntry(dayIdx, key)
                const slotKey = `${dayIdx}-${key}`
                const isLoading = loadingSlot === slotKey
                const SlotIcon = MEAL_ICONS[iconKey]

                return (
                  <div key={key} className="slot-row">
                    <span className="slot-emoji">{SlotIcon && <SlotIcon style={{ width: 14, height: 14 }} />}</span>
                    <span className="slot-label">{label}</span>

                    {entry?.meal ? (
                      <div className="slot-meal-row">
                        <span className="slot-meal-name">{entry.meal.name}</span>
                        <button
                          onClick={() => onRemove(entry.id)}
                          className="slot-remove-btn"
                        >
                          <X style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelecting({ day: dayIdx, type: key })}
                        disabled={isLoading}
                        className="slot-assign-btn"
                      >
                        {isLoading ? (
                          <span className="text-hint fs-12">Cargando...</span>
                        ) : (
                          <>
                            <Plus style={{ width: 14, height: 14 }} />
                            Asignar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!selecting}
        onClose={() => { setSelecting(null); setSearchQuery('') }}
        title={selecting ? `${MEAL_TYPES.find((m) => m.key === selecting.type)?.label} — ${DIAS_CORTOS[selecting.day]}` : ''}
      >
        <div className="stack-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar comida..."
            className="input"
            autoFocus
          />
          <div className="modal-search-list">
            {filteredMeals.length === 0 ? (
              <p className="modal-empty">No se encontraron comidas</p>
            ) : (
              filteredMeals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => handleAssign(meal.id)}
                  className="modal-meal-btn"
                >
                  <Utensils style={{ width: 18, height: 18, color: 'var(--muted)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="fs-14 fw-600 truncate">{meal.name}</p>
                    <p className="fs-12 text-muted" style={{ textTransform: 'capitalize' }}>{meal.category}</p>
                  </div>
                  {(meal.vote_score ?? 0) > 0 && (
                    <span className="modal-meal-score">+{meal.vote_score}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
