import { useState } from 'react'
import { calcLine, inr, pctFor, taxActive } from '../lib/orderUtils'

// Bottom sheet to add or edit one item. Tax percents come from Settings (or the product's own %), and can be tweaked per line.
export default function ItemSheet({ item, products, settings, onSave, onClose }) {
  const f = settings.fields, tax = taxActive(settings)
  const [it, setIt] = useState(item || { name: '', category: '', description: '', unit: '', quantity: 1, unit_price: '', cgst_pct: pctFor(settings, 'cgst'), sgst_pct: pctFor(settings, 'sgst'), igst_pct: pctFor(settings, 'igst'), product_id: null })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setIt({ ...it, [k]: e.target.value })

  const pick = (e) => {
    const name = e.target.value
    const p = products.find(x => x.name.toLowerCase() === name.trim().toLowerCase())
    if (!p) return setIt({ ...it, name, product_id: null })
    setIt({ ...it, name: p.name, product_id: p.id, category: p.category || '', unit: p.unit || '', unit_price: p.unit_price,
      cgst_pct: pctFor(settings, 'cgst', p), sgst_pct: pctFor(settings, 'sgst', p), igst_pct: pctFor(settings, 'igst', p) })
  }
  const line = calcLine({ ...it, quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 })

  const save = () => {
    if (!it.name.trim()) return setErr('Enter the item name')
    if (!(Number(it.quantity) > 0)) return setErr('Quantity must be more than 0')
    if (it.unit_price === '' || Number(it.unit_price) < 0) return setErr('Enter the unit price')
    onSave({ ...it, name: it.name.trim(), quantity: Number(it.quantity), unit_price: Number(it.unit_price),
      cgst_pct: Number(it.cgst_pct) || 0, sgst_pct: Number(it.sgst_pct) || 0, igst_pct: Number(it.igst_pct) || 0 })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{item ? 'Edit item' : 'Add item'}</div>
        <div className="modal-subtitle">Pick a saved product or type a new one.</div>

        <div className="form-group"><label className="form-label">Item name</label>
          <input className="form-input" list="prod-list" value={it.name} onChange={pick} placeholder="Start typing…" autoFocus />
          <datalist id="prod-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist></div>

        {f.category && <div className="form-group"><label className="form-label">{settings.category_label}</label><input className="form-input" value={it.category || ''} onChange={set('category')} /></div>}
        {f.description && <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={it.description || ''} onChange={set('description')} /></div>}

        <div className="grid2">
          <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" inputMode="decimal" min="0" step="any" value={it.quantity} onChange={set('quantity')} /></div>
          {f.unit && <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={it.unit || ''} onChange={set('unit')} placeholder="kg, pcs…" /></div>}
        </div>
        <div className="form-group"><label className="form-label">Unit price (₹)</label><input className="form-input" type="number" inputMode="decimal" min="0" step="any" value={it.unit_price} onChange={set('unit_price')} /></div>

        {tax && <div className="grid3">
          {['cgst', 'sgst', 'igst'].filter(k => settings.tax[k].on).map(k => (
            <div className="form-group" key={k}><label className="form-label">{k.toUpperCase()} %</label>
              <input className="form-input" type="number" inputMode="decimal" min="0" step="any" value={it[k + '_pct']} onChange={set(k + '_pct')} /></div>))}
        </div>}

        <div className="sum-box">
          <span>Amount {tax ? '(with tax)' : ''}</span><b>{inr(line.total)}</b>
        </div>
        {err && <div className="err-text">✕ {err}</div>}
        <div className="flex gap-2 mt-3">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>{item ? 'Save item' : 'Add item'}</button>
        </div>
      </div>
    </div>
  )
}
