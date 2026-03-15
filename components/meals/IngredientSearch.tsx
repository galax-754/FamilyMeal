'use client'
import { useState, useEffect, useRef } from 'react'

export interface CatalogIngredient {
  id: string
  name: string
  category: string
  unit: string
  price_mxn: number
}

export interface SelectedIngredient extends CatalogIngredient {
  quantity: number
}

interface IngredientSearchProps {
  selected: SelectedIngredient[]
  onChange: (ingredients: SelectedIngredient[]) => void
}

export function IngredientSearch({ selected, onChange }: IngredientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogIngredient[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showAddNew, setShowAddNew] = useState(false)
  const [newIngName, setNewIngName] = useState('')
  const [newIngUnit, setNewIngUnit] = useState('pieza')
  const [newIngPrice, setNewIngPrice] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowResults(false)
      setShowAddNew(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true)
      try {
        const res = await fetch(`/api/ingredientes?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        const list: CatalogIngredient[] = data.ingredients || []
        setResults(list)
        setShowResults(list.length > 0)
        setShowAddNew(list.length === 0)
      } finally {
        setLoadingSearch(false)
      }
    }, 300)
  }, [query])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
        setShowAddNew(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addIngredient(ing: CatalogIngredient) {
    if (selected.find((s) => s.id === ing.id)) return
    onChange([...selected, { ...ing, quantity: 1 }])
    setQuery('')
    setShowResults(false)
    setShowAddNew(false)
  }

  function removeIngredient(id: string) {
    onChange(selected.filter((s) => s.id !== id))
  }

  function updateQuantity(id: string, quantity: number) {
    onChange(selected.map((s) => (s.id === id ? { ...s, quantity } : s)))
  }

  async function addNewIngredient() {
    const nombre = newIngName.trim() || query.trim()
    if (!nombre) return

    setSavingNew(true)
    try {
      const res = await fetch('/api/ingredientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nombre,
          category: 'Otros',
          unit: newIngUnit,
          price_mxn: parseFloat(newIngPrice) || 0,
        }),
      })
      const data = await res.json()
      if (data.ingredient) {
        addIngredient(data.ingredient)
        setShowAddNew(false)
        setNewIngName('')
        setNewIngPrice('')
        setNewIngUnit('pieza')
      }
    } catch (err) {
      console.error('Error agregando ingrediente:', err)
    } finally {
      setSavingNew(false)
    }
  }

  const totalCost = selected.reduce(
    (sum, ing) => sum + ing.price_mxn * ing.quantity,
    0
  )

  return (
    <div>
      {/* Lista de ingredientes seleccionados */}
      {selected.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Ingredientes ({selected.length})
            </span>
            <span style={{ fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
              ~${totalCost.toFixed(0)} MXN
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selected.map((ing) => (
              <div key={ing.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  flex: 1,
                  fontWeight: 500,
                }}>
                  {ing.name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(ing.id, Math.max(0.5, ing.quantity - 0.5))}
                    style={{
                      width: '24px', height: '24px',
                      borderRadius: '50%',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >−</button>

                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}>
                    {ing.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => updateQuantity(ing.id, ing.quantity + 0.5)}
                    style={{
                      width: '24px', height: '24px',
                      borderRadius: '50%',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >+</button>

                  <span style={{
                    fontSize: '11px',
                    color: 'var(--muted)',
                    marginLeft: '2px',
                    minWidth: '28px',
                  }}>
                    {ing.unit}
                  </span>
                </div>

                <span style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  minWidth: '44px',
                  textAlign: 'right',
                }}>
                  ${(ing.price_mxn * ing.quantity).toFixed(0)}
                </span>

                <button
                  type="button"
                  onClick={() => removeIngredient(ing.id)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--red)', cursor: 'pointer',
                    fontSize: '18px', padding: '0 2px',
                    lineHeight: 1,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador con dropdown */}
      <div ref={containerRef} style={{ position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 Buscar ingrediente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 2 && results.length > 0) setShowResults(true)
          }}
        />

        {loadingSearch && (
          <div style={{
            position: 'absolute',
            right: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '12px',
            color: 'var(--muted)',
          }}>
            Buscando...
          </div>
        )}

        {/* Resultados */}
        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border-med)',
            borderRadius: 'var(--r-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 50,
            maxHeight: '240px',
            overflowY: 'auto',
            marginTop: '4px',
          }}>
            {results.map((ing, i) => {
              const isSelected = !!selected.find((s) => s.id === ing.id)
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => addIngredient(ing)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--green)' : 'var(--text)',
                    }}>
                      {isSelected ? '✓ ' : ''}{ing.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {ing.category} · por {ing.unit}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--amber)', fontWeight: 600 }}>
                    ${ing.price_mxn}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Agregar nuevo ingrediente */}
        {showAddNew && query.length >= 2 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border-med)',
            borderRadius: 'var(--r-sm)',
            padding: '14px',
            zIndex: 50,
            marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
              No encontramos &ldquo;{query}&rdquo;. ¿Quieres agregarlo?
            </p>

            <input
              type="text"
              className="input"
              placeholder="Nombre del ingrediente"
              value={newIngName || query}
              onChange={(e) => setNewIngName(e.target.value)}
              style={{ marginBottom: '8px' }}
            />

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select
                className="input"
                value={newIngUnit}
                onChange={(e) => setNewIngUnit(e.target.value)}
                style={{ flex: 1 }}
              >
                {['pieza', 'kg', 'litro', 'bolsa', 'paquete', 'cda', 'cdita', 'taza', 'g', 'ml', 'lata'].map(
                  (u) => (
                    <option key={u} value={u}>{u}</option>
                  )
                )}
              </select>
              <input
                type="number"
                className="input"
                placeholder="Precio $"
                value={newIngPrice}
                onChange={(e) => setNewIngPrice(e.target.value)}
                style={{ flex: 1 }}
                min="0"
                step="0.5"
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={addNewIngredient}
              disabled={savingNew}
              style={{ width: '100%', fontSize: '13px' }}
            >
              {savingNew ? 'Agregando...' : '+ Agregar ingrediente'}
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
        Escribe al menos 2 letras para buscar. Si no existe puedes agregarlo.
      </p>
    </div>
  )
}
