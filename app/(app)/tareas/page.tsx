'use client'

import { useEffect, useState } from 'react'
import { Plus, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChoreItem } from '@/components/chores/ChoreItem'
import { ChoreItemSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage, EmptyState } from '@/components/ui/ErrorMessage'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Chore, Profile } from '@/types'

export default function TareasPage() {
  const [chores, setChores] = useState<Chore[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [adding, setAdding] = useState(false)

  const toast = useToast()
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: prof } = await supabase.from('profiles').select('family_id').eq('id', user.id).single()
      if (!prof?.family_id) return
      setFamilyId(prof.family_id)

      const [{ data: choresData }, { data: membersData }] = await Promise.all([
        supabase
          .from('chores')
          .select('*, assignee:profiles!chores_assigned_to_fkey(*)')
          .eq('family_id', prof.family_id)
          .order('completed', { ascending: true })
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('family_id', prof.family_id),
      ])

      setChores(choresData ?? [])
      setMembers(membersData ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('chores')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id)

    if (error) {
      toast.error('Algo salió mal. Intenta de nuevo.')
      return
    }
    setChores((prev) => prev.map((c) => c.id === id ? { ...c, completed, completed_at: completed ? new Date().toISOString() : null } : c))
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('chores').delete().eq('id', id)
    if (error) { toast.error('Algo salió mal. Intenta de nuevo.'); return }
    setChores((prev) => prev.filter((c) => c.id !== id))
    toast.success('Tarea eliminada')
  }

  const handleAdd = async () => {
    if (!newTitle.trim() || !familyId || !userId) return
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('chores')
        .insert({
          family_id: familyId,
          title: newTitle.trim(),
          assigned_to: newAssignee || null,
          due_date: newDueDate || null,
          created_by: userId,
        })
        .select('*, assignee:profiles!chores_assigned_to_fkey(*)')
        .single()

      if (error) throw error
      setChores((prev) => [data, ...prev])
      setNewTitle('')
      setNewAssignee('')
      setNewDueDate('')
      setShowAdd(false)
      toast.success('Tarea agregada correctamente.')
    } catch {
      toast.error('Algo salió mal. Intenta de nuevo.')
    } finally {
      setAdding(false)
    }
  }

  const pending   = chores.filter((c) => !c.completed)
  const completed = chores.filter((c) => c.completed)

  return (
    <div>
      <PageHeader
        title="Tareas"
        action={
          <button onClick={() => setShowAdd(true)} className="btn-add-header">
            <Plus style={{ width: 20, height: 20 }} />
            Nueva
          </button>
        }
      />

      <div className="page-content stack-4">
        {loading ? (
          <div className="stack-3">
            {[1, 2, 3].map((i) => <ChoreItemSkeleton key={i} />)}
          </div>
        ) : error ? (
          <ErrorMessage type="generic" onRetry={load} />
        ) : (
          <>
            <div className="stack-3">
              {pending.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 style={{ width: 40, height: 40 }} />}
                  title="¡Todo al día!"
                  description="No hay tareas pendientes"
                  action={{ label: 'Agregar tarea', onClick: () => setShowAdd(true) }}
                />
              ) : (
                <>
                  <p className="pending-label">Pendientes ({pending.length})</p>
                  {pending.map((chore) => (
                    <ChoreItem key={chore.id} chore={chore} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </>
              )}
            </div>

            {completed.length > 0 && (
              <div className="stack-3">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="btn-toggle-completed"
                >
                  Completadas ({completed.length})
                  <span className="fs-11">{showCompleted ? '▲' : '▼'}</span>
                </button>
                {showCompleted && completed.map((chore) => (
                  <ChoreItem key={chore.id} chore={chore} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nueva tarea">
        <div className="stack-4">
          <div className="form-field">
            <label className="form-label">
              Tarea <span className="form-required">*</span>
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Comprar verduras"
              autoFocus
              className="input"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Asignar a</label>
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="input"
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Fecha límite</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>

          <Button fullWidth onClick={handleAdd} loading={adding} disabled={!newTitle.trim()}>
            Agregar tarea
          </Button>
        </div>
      </Modal>
    </div>
  )
}
