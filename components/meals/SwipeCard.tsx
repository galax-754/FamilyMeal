'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
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
const SWIPE_THRESHOLD = 80 // px para activar voto

export function SwipeCard({
  meal,
  members,
  swipeVotes,
  currentUserId,
  onLike,
  onPass,
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // ── Hint inicial ────────────────────────────────────────────
  const [showHint, setShowHint] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // ── Drag state ──────────────────────────────────────────────
  const [dragStartX, setDragStartX]   = useState(0)
  const [dragStartY, setDragStartY]   = useState(0)
  const [dragOffset, setDragOffset]   = useState(0)
  const [isDragging, setIsDragging]   = useState(false)
  // Evitar detectar scroll vertical como swipe
  const dragDirectionRef = useRef<'horizontal' | 'vertical' | null>(null)

  const currentUserVoted = swipeVotes.some((v) => v.profile_id === currentUserId)
  const ingredients  = Array.isArray(meal.ingredients)  ? meal.ingredients  : []
  const instructions = Array.isArray(meal.instructions) ? meal.instructions : []

  // ── Animación de salida (compartida por botones y swipe) ─────
  const triggerLike = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    setDragOffset(0)
    setIsDragging(false)
    el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
    el.style.transform   = 'translateX(120%) rotate(12deg)'
    el.style.opacity     = '0'
    setTimeout(() => onLike(meal.id), 350)
  }, [meal.id, onLike])

  const triggerPass = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    setDragOffset(0)
    setIsDragging(false)
    el.style.transition = 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
    el.style.transform   = 'translateX(-120%) rotate(-12deg)'
    el.style.opacity     = '0'
    setTimeout(() => onPass(meal.id), 350)
  }, [meal.id, onPass])

  // ── Touch handlers ──────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartX(e.touches[0].clientX)
    setDragStartY(e.touches[0].clientY)
    dragDirectionRef.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - dragStartX
    const dy = e.touches[0].clientY - dragStartY

    // Determinar dirección solo una vez por gesto
    if (!dragDirectionRef.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        dragDirectionRef.current = 'horizontal'
      } else if (Math.abs(dy) > 8) {
        dragDirectionRef.current = 'vertical'
      }
    }

    if (dragDirectionRef.current === 'horizontal') {
      e.preventDefault() // evitar scroll mientras desliza
      setIsDragging(true)
      setDragOffset(dx)
    }
  }

  const handleTouchEnd = () => {
    if (dragDirectionRef.current === 'horizontal') {
      if (dragOffset > SWIPE_THRESHOLD) {
        triggerLike()
      } else if (dragOffset < -SWIPE_THRESHOLD) {
        triggerPass()
      } else {
        setDragOffset(0)
        setIsDragging(false)
      }
    }
    dragDirectionRef.current = null
  }

  // ── Mouse handlers (desktop) ────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartX(e.clientX)
    setDragStartY(e.clientY)
    dragDirectionRef.current = null
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return // solo si botón izquierdo está presionado
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY

    if (!dragDirectionRef.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        dragDirectionRef.current = 'horizontal'
      } else if (Math.abs(dy) > 8) {
        dragDirectionRef.current = 'vertical'
      }
    }

    if (dragDirectionRef.current === 'horizontal') {
      setIsDragging(true)
      setDragOffset(dx)
    }
  }

  const handleMouseUp = () => {
    if (dragDirectionRef.current === 'horizontal' && isDragging) {
      if (dragOffset > SWIPE_THRESHOLD) {
        triggerLike()
      } else if (dragOffset < -SWIPE_THRESHOLD) {
        triggerPass()
      } else {
        setDragOffset(0)
        setIsDragging(false)
      }
    } else {
      setDragOffset(0)
      setIsDragging(false)
    }
    dragDirectionRef.current = null
  }

  // ── Estilos dinámicos ───────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    position:   'relative',
    transform:  `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)`,
    transition: isDragging ? 'none' : 'transform 0.3s ease',
    cursor:     isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  }

  const showLike = dragOffset > 30
  const showPass = dragOffset < -30

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Label ME GUSTA ──────────────────────────────────── */}
      {showLike && (
        <div style={{
          position:     'absolute',
          top:          '20px',
          left:         '20px',
          background:   'rgba(34,197,94,0.9)',
          color:        'white',
          padding:      '8px 16px',
          borderRadius: '8px',
          fontSize:     '18px',
          fontWeight:   800,
          border:       '3px solid white',
          zIndex:       10,
          transform:    'rotate(-15deg)',
          pointerEvents:'none',
        }}>
          ❤️ ME GUSTA
        </div>
      )}

      {/* ── Label PASO ──────────────────────────────────────── */}
      {showPass && (
        <div style={{
          position:     'absolute',
          top:          '20px',
          right:        '20px',
          background:   'rgba(239,68,68,0.9)',
          color:        'white',
          padding:      '8px 16px',
          borderRadius: '8px',
          fontSize:     '18px',
          fontWeight:   800,
          border:       '3px solid white',
          zIndex:       10,
          transform:    'rotate(15deg)',
          pointerEvents:'none',
        }}>
          ✕ PASO
        </div>
      )}

      {/* ── CONTENIDO SCROLLABLE ─────────────────────────────── */}
      <div style={{
        height:       'calc(100vh - 180px)',
        overflowY:    'auto',
        overflowX:    'hidden',
        paddingBottom:'20px',
        borderRadius: 'var(--r)',
        border:       '1px solid var(--border)',
        background:   'var(--surface)',
      }}>

        {/* Imagen hero */}
        <div style={{
          width: '100%', height: '260px',
          position: 'relative', background: 'var(--surface2)',
          flexShrink: 0,
        }}>
          {meal.image_url ? (
            <>
              <Image
                src={meal.image_url}
                alt={meal.name}
                fill
                style={{ objectFit: 'cover' }}
                unoptimized
              />
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

        {/* Body */}
        <div style={{ padding: '16px' }}>

          {/* Categoría + nombre */}
          <div style={{ marginBottom: '12px' }}>
            <span className="badge badge-amber" style={{ marginBottom: '8px', display: 'inline-block' }}>
              {meal.category}
            </span>
            {meal.is_diabetic_friendly && (
              <span className="badge badge-green" style={{ marginLeft: '6px' }}>
                🩺 Apto diabético
              </span>
            )}
            <h2 style={{
              fontSize: '20px', fontWeight: 900,
              color: 'var(--text)', lineHeight: 1.2,
              marginTop: '6px', marginBottom: '6px',
            }}>
              {meal.name}
            </h2>
            {meal.description && (
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                {meal.description}
              </p>
            )}
          </div>

          {/* Métricas */}
          <div className="swipe-badges-row" style={{ marginBottom: '16px' }}>
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
            {meal.difficulty && (
              <span className="badge badge-dark">👨‍🍳 {meal.difficulty}</span>
            )}
          </div>

          {/* Votos de la familia */}
          {members.length > 0 && (
            <div className="swipe-family-votes" style={{ marginBottom: '20px' }}>
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
                          style={{ border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent' }}
                        />
                      ) : vote.vote === 1 ? (
                        <div className="voter-status voter-voted">✓</div>
                      ) : (
                        <div className="voter-status" style={{ background: 'var(--red)', fontSize: 8 }}>✕</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ingredientes */}
          {ingredients.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '13px', fontWeight: 800,
                color: 'var(--text)', marginBottom: '10px',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                🛒 Ingredientes
              </h3>
              {ingredients.map((ing, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>{ing.name}</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Instrucciones */}
          {instructions.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '13px', fontWeight: 800,
                color: 'var(--text)', marginBottom: '10px',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                📝 Preparación
              </h3>
              {instructions.map((inst, i) => (
                <div
                  key={i}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{
                    fontSize: '11px', fontWeight: 700,
                    color: 'var(--amber)', marginBottom: '4px',
                    textTransform: 'uppercase',
                  }}>
                    PASO {inst.step} — {inst.title}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                    {inst.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Chef tip */}
          {meal.chef_tip && (
            <div style={{
              padding:      '14px',
              background:   'var(--amber-soft)',
              border:       '1px solid rgba(245,158,11,0.25)',
              borderRadius: 'var(--r-sm)',
            }}>
              <div style={{
                fontSize: '12px', fontWeight: 700,
                color: 'var(--amber)', marginBottom: '6px',
              }}>
                👨‍🍳 Tip del chef
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                {meal.chef_tip}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── HINT INICIAL (desaparece en 3s) ─────────────────── */}
      {showHint && (
        <div style={{
          position:      'fixed',
          bottom:        '90px',
          left:          0,
          right:         0,
          display:       'flex',
          justifyContent:'center',
          gap:           '32px',
          zIndex:        20,
          animation:     'fadeOut 3s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '6px',
            color:      'rgba(239,68,68,0.8)',
            fontSize:   '13px',
            fontWeight: 600,
          }}>
            ← Paso
          </div>
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '6px',
            color:      'rgba(34,197,94,0.8)',
            fontSize:   '13px',
            fontWeight: 600,
          }}>
            Me gusta →
          </div>
        </div>
      )}


    </div>
  )
}
