import { useState, useRef, useEffect } from 'react'
import { inr, calcLine, pctFor } from '../lib/orderUtils'

export default function SpeedDialPicker({ products = [], settings, onAdd }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [qty, setQty] = useState('1')
  const [filter, setFilter] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (selectedProduct && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [selectedProduct])

  if (!products || products.length === 0) {
    return null
  }

  const query = filter.trim().toLowerCase()
  const visibleProducts = query
    ? products.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query)))
    : products.slice(0, 15) // Top 15 quick products

  const handleSelect = (product) => {
    setSelectedProduct(product)
    setQty('1')
  }

  const handleAdd = (e) => {
    e?.preventDefault()
    if (!selectedProduct) return
    const numQty = parseFloat(qty)
    if (!numQty || numQty <= 0) return

    const it = {
      name: selectedProduct.name,
      category: selectedProduct.category || '',
      description: selectedProduct.description || '',
      unit: selectedProduct.unit || '',
      quantity: numQty,
      unit_price: Number(selectedProduct.unit_price) || 0,
      cgst_pct: pctFor(settings, 'cgst', selectedProduct),
      sgst_pct: pctFor(settings, 'sgst', selectedProduct),
      igst_pct: pctFor(settings, 'igst', selectedProduct),
      product_id: selectedProduct.id || null,
    }

    onAdd(it)
    setSelectedProduct(null)
    setQty('1')
    setFilter('')
  }

  return (
    <div className="speed-dial-box" style={{
      background: 'var(--card-bg, #f8fafc)',
      border: '1.5px solid var(--border, #e2e8f0)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 14,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem' }}>⚡</span>
          <span style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--text)' }}>
            Speed Dial Items
          </span>
          <span style={{
            fontSize: '.72rem',
            background: 'var(--teal-light, #e6fffa)',
            color: 'var(--teal-dark, #0d9488)',
            padding: '2px 6px',
            borderRadius: 6,
            fontWeight: 500
          }}>
            Tap & enter qty
          </span>
        </div>
        {products.length > 8 && (
          <input
            type="text"
            placeholder="Filter speed dial…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              fontSize: '.75rem',
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border, #cbd5e1)',
              background: '#fff',
              maxWidth: 130
            }}
          />
        )}
      </div>

      {/* Grid of speed dial tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 8,
      }}>
        {visibleProducts.map((p, idx) => {
          const isSelected = selectedProduct?.id === p.id || selectedProduct?.name === p.name
          return (
            <button
              key={p.id || p.name}
              type="button"
              onClick={() => handleSelect(p)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 8,
                border: isSelected
                  ? '2px solid var(--teal, #0d9488)'
                  : '1px solid var(--border, #e2e8f0)',
                background: isSelected ? 'var(--teal-light, #f0fdfa)' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{
                  fontSize: '.68rem',
                  fontWeight: 700,
                  color: isSelected ? 'var(--teal, #0d9488)' : 'var(--text-muted, #64748b)',
                  background: isSelected ? 'transparent' : 'rgba(0,0,0,0.04)',
                  padding: '1px 4px',
                  borderRadius: 4
                }}>
                  #{idx + 1}
                </span>
                {p.unit && (
                  <span style={{ fontSize: '.68rem', color: 'var(--text-muted, #94a3b8)' }}>
                    /{p.unit}
                  </span>
                )}
              </div>
              <div style={{
                fontWeight: 600,
                fontSize: '.82rem',
                color: 'var(--text, #1e293b)',
                lineHeight: 1.25,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                width: '100%'
              }}>
                {p.name}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--teal-dark, #0f766e)', fontWeight: 600 }}>
                {inr(p.unit_price)}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Product Quantity Input Popup / Inline Strip */}
      {selectedProduct && (
        <form
          onSubmit={handleAdd}
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#fff',
            borderRadius: 8,
            border: '1.5px solid var(--teal, #0d9488)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
            <span style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--text)' }}>
              {selectedProduct.name}
            </span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
              Rate: {inr(selectedProduct.unit_price)} {selectedProduct.unit ? `per ${selectedProduct.unit}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>
              Qty:
            </label>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="any"
              min="0.001"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="Qty (e.g. 0.5, 2)"
              style={{
                width: 90,
                padding: '6px 10px',
                fontSize: '.95rem',
                fontWeight: 600,
                textAlign: 'center',
                border: '1.5px solid var(--teal, #0d9488)',
                borderRadius: 6,
                background: '#fff'
              }}
            />
            {selectedProduct.unit && (
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {selectedProduct.unit}
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px', fontSize: '.82rem', fontWeight: 600 }}
            >
              ✓ Add
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedProduct(null)}
              style={{ color: 'var(--text-muted)', padding: '6px 8px' }}
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
