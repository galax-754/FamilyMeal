'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Clock, ThumbsUp, ThumbsDown, Sparkles, Utensils } from 'lucide-react'
import { Meal } from '@/types'
import { CATEGORY_COLORS, CATEGORY_LABELS, formatPrepTime } from '@/lib/utils'

interface MealCardProps {
  meal: Meal
  onVote?: (mealId: string, vote: -1 | 0 | 1) => void
  showVote?: boolean
}

export function MealCard({ meal, onVote, showVote = true }: MealCardProps) {
  const score = meal.vote_score ?? 0
  const myVote = meal.my_vote
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <Link href={`/comidas/${meal.id}`} className="card-meal">
      <div className="meal-card-img" style={{ position: 'relative' }}>
        {meal.image_url ? (
          <>
            {!imageLoaded && (
              <div
                className="skeleton"
                style={{ position: 'absolute', inset: 0 }}
              />
            )}
            <Image
              src={meal.image_url}
              alt={meal.name}
              fill
              style={{
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
              onLoad={() => setImageLoaded(true)}
            />
            <div className="meal-img-overlay" />
          </>
        ) : (
          <div className="meal-img-placeholder"><Utensils style={{ width: 32, height: 32 }} /></div>
        )}

        {meal.analyzed_by_ai && (
          <div className="badge-ai">
            <Sparkles style={{ width: 12, height: 12 }} />
            IA
          </div>
        )}

        {meal.image_url && score !== 0 && (
          <div className={`score-badge ${score > 0 ? 'score-badge-pos' : 'score-badge-neg'}`}>
            {score > 0 ? '+' : ''}{score}
          </div>
        )}
      </div>

      <div className="meal-card-body">
        <div className="flex items-center gap-8">
          <h3 className="meal-name">{meal.name}</h3>
          {!meal.image_url && score !== 0 && (
            <span className={`score-inline ${score > 0 ? 'score-inline-pos' : 'score-inline-neg'}`}>
              {score > 0 ? '+' : ''}{score}
            </span>
          )}
        </div>

        {meal.description && (
          <p className="meal-desc">{meal.description}</p>
        )}

        <div className="meal-meta">
          <span className={CATEGORY_COLORS[meal.category]}>{CATEGORY_LABELS[meal.category]}</span>
          {meal.prep_time_minutes && (
            <span className="meal-time">
              <Clock style={{ width: 14, height: 14 }} />
              {formatPrepTime(meal.prep_time_minutes)}
            </span>
          )}
        </div>

        {showVote && onVote && (
          <div className="vote-row" onClick={(e) => e.preventDefault()}>
            <button
              onClick={() => onVote(meal.id, myVote === 1 ? 0 : 1)}
              className={`vote-btn vote-btn-like${myVote === 1 ? ' voted' : ''}`}
            >
              <ThumbsUp style={{ width: 16, height: 16 }} />
              Me gusta
            </button>
            <button
              onClick={() => onVote(meal.id, myVote === -1 ? 0 : -1)}
              className={`vote-btn vote-btn-dislike${myVote === -1 ? ' voted' : ''}`}
            >
              <ThumbsDown style={{ width: 16, height: 16 }} />
              No me gusta
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}
