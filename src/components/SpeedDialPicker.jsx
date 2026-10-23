import { useState, useRef, useEffect } from 'react'
import { inr, pctFor } from '../lib/orderUtils'

export default function SpeedDialPicker({ products = [], settings, onAdd }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [qty, setQty] = useState('1')
  const [directNum, setDirectNum] = useState('')
  const qtyInputRef = useRef(null)

  useEffect(() => {
    if (selectedProduct && qtyInputRef.current) {
      qtyInputRef.current.focus()
      qtyInputRef.current.select()
    }
  }, [selectedProduct])

  if (!products || products.length === 0) {
    return null
  }

  const handleSelect = (product, idx) => {
    setSelectedProduct(product)
    setSelectedIndex(idx + 1)
    setQty('1')
  }

  const handleDirectJump = (e) => {
    const val = e.target.value
    setDirectNum(val)
    const n = parseInt(val, 10)
    if (n >= 1 && n <= products.length) {
      handleSelect(products[n - 1], n - 1)
      setDirectNum('')
    }
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
    setSelectedIndex(null)
    setQty('1')
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
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
            Speed Dial
          </span>
          <span style={{
            fontSize: '.72rem',
            background: 'var(--teal-light, #e6fffa)',
            color: 'var(--teal-dark, #0d9488)',
            padding: '2px 6px',
            borderRadius: 6,
            fontWeight: 600
          }}>
            Select number
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Type #:</span>
          <input
            type="number"
            min="1"
            max={products.length}
            placeholder="1.."
            value={directNum}
            onChange={handleDirectJump}
            style={{
              width: 50,
              fontSize: '.82rem',
              fontWeight: 700,
              textAlign: 'center',
              padding: '4px 6px',
              borderRadius: 6,
              border: '1.5px solid var(--border, #cbd5e1)',
              background: '#fff'
            }}
          />
        </div>
      </div>

      {/* Clean Number-Only Tiles (1, 2, 3...) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        maxHeight: 140,
        overflowY: 'auto',
        padding: '2px 0'
      }}>
        {products.map((p, idx) => {
          const num = idx + 1
          const isSelected = selectedIndex === num
          return (
            <button
              key={p.id || p.name}
              type="button"
              title={`${num}. ${p.name} (${inr(p.unit_price)}${p.unit ? `/${p.unit}` : ''})`}
              onClick={() => handleSelect(p, idx)}
              style={{
                width: 44,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                fontSize: '.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid var(--teal, #0d9488)'
                  : '1px solid var(--border, #cbd5e1)',
                background: isSelected
                  ? 'var(--teal, #0d9488)'
                  : '#fff',
                color: isSelected
                  ? '#fff'
                  : 'var(--text, #1e293b)',
                boxShadow: isSelected
                  ? '0 2px 4px rgba(13,148,136,0.3)'
                  : '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.1s ease',
              }}
            >
              {num}
            </button>
          )
        })}
      </div>

      {/* Selected Product Quantity Input Strip */}
      {selectedProduct && (
        <form
          onSubmit={handleAdd}
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: '#fff',
            borderRadius: 8,
            border: '2px solid var(--teal, #0d9488)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                background: 'var(--teal, #0d9488)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: '.75rem',
                fontWeight: 700
              }}>
                #{selectedIndex}
              </span>
              <span style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--text)' }}>
                {selectedProduct.name}
              </span>
            </div>
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              Rate: <b>{inr(selectedProduct.unit_price)}</b> {selectedProduct.unit ? `per ${selectedProduct.unit}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>
              Qty:
            </label>
            <input
              ref={qtyInputRef}
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
                fontSize: '1rem',
                fontWeight: 700,
                textAlign: 'center',
                border: '1.5px solid var(--teal, #0d9488)',
                borderRadius: 6,
                background: '#fff'
              }}
            />
            {selectedProduct.unit && (
              <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {selectedProduct.unit}
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 16px', fontSize: '.85rem', fontWeight: 600 }}
            >
              ✓ Add
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setSelectedProduct(null); setSelectedIndex(null) }}
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
