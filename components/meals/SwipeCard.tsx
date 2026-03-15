'use client'

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { Clock, DollarSign, Utensils } from 'lucide-react'
import { Meal, Profile, SwipeVote } from '@/types'
import { formatPrepTime } from '@/lib/utils'

interface SwipeCardProps {
  meal: Meal
  members: Profile[]
  swipeVotes: SwipeVote[]
  currentUserId: string
  onLike: (mealId: string) => void
  onPass: (mealId: string) => void
}

const AVATAR_COLORS = ['av-amber', 'av-pink', 'av-indigo', 'av-green']

export function SwipeCard({
  meal,
  members,
  swipeVotes,
  currentUserId,
  onLike,
  onPass,
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [deltaX, setDeltaX] = useState(0)
  const isDragging = useRef(false)
  const startX = useRef(0)

  const currentUserVoted = swipeVotes.some((v) => v.profile_id === currentUserId)

  const resetPosition = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
    el.style.transform = ''
    el.style.opacity = ''
    setDeltaX(0)
  }, [])

  const triggerLike = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
    el.style.transform = 'translateX(120%) rotate(12deg)'
    el.style.opacity = '0'
    setTimeout(() => onLike(meal.id), 350)
  }, [meal.id, onLike])

  const triggerPass = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
    el.style.transform = 'translateX(-120%) rotate(-12deg)'
    el.style.opacity = '0'
    setTimeout(() => onPass(meal.id), 350)
  }, [meal.id, onPass])

  const handleDragEnd = useCallback(
    (dx: number) => {
      const THRESHOLD = 80
      if (dx > THRESHOLD) triggerLike()
      else if (dx < -THRESHOLD) triggerPass()
      else resetPosition()
    },
    [triggerLike, triggerPass, resetPosition]
  )

  // ── Mouse events ──────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    const el = cardRef.current
    if (el) el.style.transition = 'none'
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - startX.current
    setDeltaX(dx)
    const el = cardRef.current
    if (el) {
      const rotate = dx * 0.08
      el.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`
    }
  }

  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    handleDragEnd(e.clientX - startX.current)
  }

  const onMouseLeave = () => {
    if (!isDragging.current) return
    isDragging.current = false
    resetPosition()
  }

  // ── Touch events ──────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true
    startX.current = e.touches[0].clientX
    const el = cardRef.current
    if (el) el.style.transition = 'none'
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    const dx = e.touches[0].clientX - startX.current
    setDeltaX(dx)
    const el = cardRef.current
    if (el) {
      const rotate = dx * 0.08
      el.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const dx = e.changedTouches[0].clientX - startX.current
    handleDragEnd(dx)
  }

  const likeOpacity = Math.min(Math.max(deltaX / 120, 0), 1)
  const passOpacity = Math.min(Math.max(-deltaX / 120, 0), 1)

  return (
    <div
      ref={cardRef}
      className="swipe-card"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Labels flotantes */}
      <div
        className="swipe-label swipe-label-like"
        style={{ opacity: likeOpacity }}
      >
        ♥ ME GUSTA
      </div>
      <div
        className="swipe-label swipe-label-pass"
        style={{ opacity: passOpacity }}
      >
        ✕ PASO
      </div>

      {/* Imagen / Emoji */}
      <div className="swipe-card-img">
        {meal.image_url ? (
          <>
            <Image src={meal.image_url} alt={meal.name} fill style={{ objectFit: 'cover' }} />
            <div className="meal-img-overlay-light" />
          </>
        ) : (
          <div className="swipe-card-placeholder">
            {meal.meal_emoji ? (
              <span style={{ fontSize: 72 }}>{meal.meal_emoji}</span>
            ) : (
              <Utensils style={{ width: 56, height: 56, color: 'rgba(255,255,255,0.3)' }} />
            )}
          </div>
        )}

        {currentUserVoted && (
          <div className="swipe-voted-badge">Ya votaste</div>
        )}
      </div>

      {/* Contenido */}
      <div className="swipe-card-body">
        <h2 className="swipe-meal-name">{meal.name}</h2>

        {meal.description && (
          <p className="swipe-meal-desc">{meal.description}</p>
        )}

        {/* Badges de info */}
        <div className="swipe-badges-row">
          {meal.estimated_cost != null && (
            <span className="badge badge-amber">
              <DollarSign style={{ width: 11, height: 11 }} />
              ${meal.estimated_cost.toFixed(0)} MXN
            </span>
          )}
          {meal.prep_time_minutes != null && (
            <span className="badge badge-dark">
              <Clock style={{ width: 11, height: 11 }} />
              {formatPrepTime(meal.prep_time_minutes)}
            </span>
          )}
          {meal.is_diabetic_friendly && (
            <span className="badge badge-green">🩺 Apto diabético</span>
          )}
        </div>

        {/* Votos de la familia */}
        {members.length > 0 && (
          <div className="swipe-family-votes">
            <p className="swipe-family-title">Votos de la familia</p>
            <div className="voters-row" style={{ gap: 10 }}>
              {members.map((m, idx) => {
                const vote = swipeVotes.find((v) => v.profile_id === m.id)
                const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                return (
                  <div key={m.id} className="voter-item">
                    <div className={`avatar avatar-sm ${colorClass}`}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    {vote == null ? (
                      <div
                        className="voter-status voter-pending"
                        style={{
                          border: '1.5px solid rgba(255,255,255,0.15)',
                          background: 'transparent',
                        }}
                      />
                    ) : vote.vote ? (
                      <div className="voter-status voter-voted">✓</div>
                    ) : (
                      <div
                        className="voter-status"
                        style={{ background: 'var(--red)', fontSize: 8 }}
                      >
                        ✕
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Botones PASS / LIKE */}
        <div className="swipe-actions">
          <button
            className="swipe-btn-pass"
            onClick={() => triggerPass()}
            aria-label="Paso"
          >
            ✕
          </button>
          <button
            className="swipe-btn-like"
            onClick={() => triggerLike()}
          >
            ♥ Me gusta
          </button>
        </div>
      </div>
    </div>
  )
}
