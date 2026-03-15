'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Clock, Sparkles, ThumbsUp, ThumbsDown, Trash2, Utensils } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Meal } from '@/types'
import { CATEGORY_COLORS, CATEGORY_LABELS, formatPrepTime } from '@/lib/utils'

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [meal, setMeal] = useState<Meal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data, error: err } = await supabase
        .from('meals')
        .select('*, meal_votes(*), ingredients(*)')
        .eq('id', id)
        .single()

      if (err) throw err

      const withScore = {
        ...data,
        vote_score: (data.meal_votes as Array<{ vote: number }>).reduce((s: number, v) => s + v.vote, 0),
        my_vote: (data.meal_votes as Array<{ profile_id: string; vote: -1 | 0 | 1 }>)
          .find((v) => v.profile_id === user.id)?.vote ?? null,
      }
      setMeal(withScore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleVote = async (vote: -1 | 0 | 1) => {
    if (!userId || !meal) return
    const newVote = meal.my_vote === vote ? 0 : vote
    try {
      if (newVote === 0) {
        await supabase.from('meal_votes').delete()
          .eq('meal_id', meal.id).eq('profile_id', userId)
      } else {
        await supabase.from('meal_votes').upsert(
          { meal_id: meal.id, profile_id: userId, vote: newVote },
          { onConflict: 'meal_id,profile_id' }
        )
      }
      const oldVote = meal.my_vote ?? 0
      const newScore = (meal.vote_score ?? 0) - oldVote + newVote
      setMeal({ ...meal, my_vote: newVote === 0 ? null : newVote, vote_score: newScore })
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    }
  }

  const handleDelete = async () => {
    if (!meal) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('meals').delete().eq('id', meal.id)
      if (error) throw error
      toast.success(`"${meal.name}" eliminada`)
      router.push('/comidas')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setDeleting(false)
      setShowDelete(false)
    }
  }

  if (loading) return <><PageHeader title="Comida" back /><PageLoader message="Cargando comida..." /></>
  if (error || !meal) return <><PageHeader title="Error" back /><ErrorMessage type="notfound" /></>

  const score = meal.vote_score ?? 0

  return (
    <div>
      <PageHeader
        title={meal.name}
        back
        action={
          <button
            onClick={() => setShowDelete(true)}
            className="btn-icon-header"
          >
            <Trash2 style={{ width: 24, height: 24 }} />
          </button>
        }
      />

      <div>
        <div className="meal-card-img-detail">
          {meal.image_url ? (
            <>
              <Image src={meal.image_url} alt={meal.name} fill style={{ objectFit: 'cover' }} />
              <div className="meal-img-overlay-light" />
            </>
          ) : (
            <div className="meal-img-placeholder meal-img-placeholder-lg"><Utensils style={{ width: 48, height: 48 }} /></div>
          )}

          <div className="img-badges-row">
            <span className={CATEGORY_COLORS[meal.category]}>{CATEGORY_LABELS[meal.category]}</span>
            {meal.analyzed_by_ai && (
              <span className="badge-ai-detail">
                <Sparkles style={{ width: 14, height: 14 }} />
                IA
              </span>
            )}
          </div>

          {score !== 0 && (
            <div className={`score-badge-detail ${score > 0 ? 'score-badge-pos' : 'score-badge-neg'}`}>
              {score > 0 ? '+' : ''}{score}
            </div>
          )}
        </div>

        <div className="page-content stack-6 mt-8">
          {meal.prep_time_minutes && (
            <div className="info-row">
              <span className="info-item">
                <Clock style={{ width: 16, height: 16 }} />
                {formatPrepTime(meal.prep_time_minutes)}
              </span>
            </div>
          )}

          {meal.description && (
            <div className="detail-section">
              <h3 className="detail-section-title">Descripción</h3>
              <p className="detail-text">{meal.description}</p>
            </div>
          )}

          {meal.ai_description && (
            <div className="ai-box">
              <p className="ai-box-title">
                <Sparkles style={{ width: 14, height: 14 }} />
                Consejo de IA
              </p>
              <p className="ai-box-text">{meal.ai_description}</p>
            </div>
          )}

          {meal.ingredients && meal.ingredients.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title mb-12">Ingredientes</h3>
              <div className="ingredient-list">
                {meal.ingredients.map((ing) => (
                  <div key={ing.id} className="ingredient-list-row">
                    <div className="ingredient-dot" />
                    <span className="ingredient-name">{ing.name}</span>
                    {(ing.quantity || ing.unit) && (
                      <span className="ingredient-qty">{ing.quantity} {ing.unit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3 className="detail-section-title mb-12">¿Te gusta este platillo?</h3>
            <div className="vote-row">
              <button
                onClick={() => handleVote(1)}
                className={`vote-btn vote-btn-lg vote-btn-like${meal.my_vote === 1 ? ' voted' : ''}`}
              >
                <ThumbsUp style={{ width: 20, height: 20 }} />
                Me gusta
              </button>
              <button
                onClick={() => handleVote(-1)}
                className={`vote-btn vote-btn-lg vote-btn-dislike${meal.my_vote === -1 ? ' voted' : ''}`}
              >
                <ThumbsDown style={{ width: 20, height: 20 }} />
                No me gusta
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar comida"
        message={`¿Seguro que quieres eliminar "${meal.name}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        loading={deleting}
        variant="danger"
      />
    </div>
  )
}
