import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useToast } from '../components/Toast'
import { guardWrite } from '../lib/shop'
import { downloadSample, readProductsFile, productHeaders } from '../lib/exportUtils'
import { inr, r2 } from '../lib/orderUtils'

const blank = { name: '', category: '', unit: '', unit_price: '', cgst: '', sgst: '', igst: '' }
const pct = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export default function ProductsPage() {
  const { shop, settings, canWrite } = useShop(), toast = useToast(), fileRef = useRef()
  const cat = settings.category_label, taxOn = settings.fields.tax
  const [list, setList] = useState([]), [loading, setLoading] = useState(true), [q, setQ] = useState('')
  const [edit, setEdit] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)   // parsed Excel rows waiting for confirmation

  const load = async () => {
    const all = []
    for (let p = 0; p < 5; p++) { const { data } = await supabase.from('order_products').select('*').order('name').range(p * 1000, p * 1000 + 999); all.push(...(data || [])); if ((data || []).length < 1000) break }
    setList(all); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const shown = list.filter(p => !q.trim() || (p.name + ' ' + (p.category || '')).toLowerCase().includes(q.trim().toLowerCase()))

  const save = async () => {
    setErr('')
    if (!edit.name.trim()) return setErr('Product name is required')
    if (edit.unit_price === '' || Number(edit.unit_price) < 0) return setErr('Enter the unit price')
    if (!guardWrite('Saving products')) return
    const row = { name: edit.name.trim(), category: edit.category?.trim() || null, unit: edit.unit?.trim() || null, unit_price: Number(edit.unit_price), cgst: pct(edit.cgst), sgst: pct(edit.sgst), igst: pct(edit.igst) }
    row.total_price = r2(row.unit_price * (1 + ((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)) / 100))
    setBusy(true)
    const { error } = edit.id ? await supabase.from('order_products').update(row).eq('id', edit.id) : await supabase.from('order_products').insert({ ...row, shop_id: shop.id })
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'A product with this name already exists' : error.message)
    setEdit(null); toast('Product saved'); load()
  }
  const del = async (p) => {
    if (!guardWrite('Deleting products') || !confirm(`Delete “${p.name}”? Old orders keep their items.`)) return
    const { error } = await supabase.from('order_products').delete().eq('id', p.id)
    if (error) return toast(error.message, 'error'); load()
  }

  const pickFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const { rows, skipped } = await readProductsFile(file, cat)
      if (!rows.length) return toast('No valid rows found. Download the sample file to see the format.', 'error')
      const seen = new Map(); rows.forEach(r => seen.set(r.name.toLowerCase(), r))     // same name twice in the file: last row wins
      const uniq = [...seen.values()]
      const exist = new Map(list.map(p => [p.name.toLowerCase(), p.id]))
      setPreview({ rows: uniq, skipped, fresh: uniq.filter(r => !exist.has(r.name.toLowerCase())).length, update: uniq.filter(r => exist.has(r.name.toLowerCase())).length, exist })
    } catch (x) { toast('Could not read the file: ' + x.message, 'error') }
  }
  const doImport = async () => {
    if (!guardWrite('Importing products')) return
    setBusy(true)
    const toIns = [], toUpd = []
    for (const r of preview.rows) { const id = preview.exist.get(r.name.toLowerCase()); id ? toUpd.push({ ...r, id, shop_id: shop.id }) : toIns.push({ ...r, shop_id: shop.id }) }
    let error = null
    for (let i = 0; i < toIns.length && !error; i += 500) error = (await supabase.from('order_products').insert(toIns.slice(i, i + 500))).error
    for (let i = 0; i < toUpd.length && !error; i += 500) error = (await supabase.from('order_products').upsert(toUpd.slice(i, i + 500), { onConflict: 'id' })).error
    setBusy(false)
    if (error) return toast('Import failed: ' + error.message, 'error')
    toast(`Imported: ${toIns.length} new, ${toUpd.length} updated`); setPreview(null); load()
  }

  const f = (k, label, props = {}) => <div className="form-group"><label className="form-label">{label}</label><input className="form-input" value={edit[k] ?? ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} {...props} /></div>

  return (
    <div className="page-wide">
      <div className="page-head">
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">Saved products fill in price, unit and tax when you create an order.</p></div>
        <button className="btn btn-primary" disabled={!canWrite} onClick={() => { setErr(''); setEdit({ ...blank }) }}>+ Add product</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>Import from Excel</div>
        <p className="text-muted" style={{ marginBottom: 10 }}>Columns: {productHeaders(cat).join(', ')}. Products with the same name are updated.</p>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadSample(cat)}>⬇️ Download sample file</button>
          <button className="btn btn-dark btn-sm" disabled={!canWrite} onClick={() => fileRef.current.click()}>⬆️ Import Excel / CSV</button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={pickFile} />
        </div>
      </div>

      <input className="form-input" placeholder={`Search products or ${cat.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {loading && <div className="empty-state">Loading…</div>}
      {!loading && !shown.length && <div className="card empty-state"><div className="empty-state-icon">🧺</div><div className="empty-state-title">{list.length ? 'No match' : 'No products yet'}</div><div className="empty-state-text">Add one, or import your list from Excel.</div></div>}
      {!!shown.length && <div className="card" style={{ padding: '4px 16px' }}>
        {shown.map(p => (
          <div className="item-row" key={p.id}>
            <div style={{ minWidth: 0 }}><b>{p.name}</b><div className="text-muted" style={{ fontSize: '.78rem' }}>{[p.category, p.unit && `per ${p.unit}`].filter(Boolean).join(' · ') || '—'}{taxOn && (p.cgst || p.sgst || p.igst) ? ` · GST ${[p.cgst && `C${Number(p.cgst)}`, p.sgst && `S${Number(p.sgst)}`, p.igst && `I${Number(p.igst)}`].filter(Boolean).join(' ')}%` : ''}</div></div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}><b>{inr(p.unit_price)}</b>{taxOn && Number(p.total_price) > Number(p.unit_price) && <div className="text-muted" style={{ fontSize: '.72rem' }}>{inr(p.total_price)} with tax</div>}
              <div className="flex gap-2 mt-1" style={{ justifyContent: 'flex-end' }}><button className="btn btn-secondary btn-sm" disabled={!canWrite} onClick={() => { setErr(''); setEdit({ ...p, cgst: p.cgst ?? '', sgst: p.sgst ?? '', igst: p.igst ?? '' }) }}>Edit</button><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={!canWrite} onClick={() => del(p)}>Delete</button></div></div>
          </div>))}
      </div>}

      {edit && <div className="modal-overlay" onClick={() => setEdit(null)}><div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{edit.id ? 'Edit product' : 'Add product'}</div><div className="modal-subtitle">&nbsp;</div>
        {f('name', 'Product name *')}{f('category', cat)}
        <div className="grid2">{f('unit', 'Unit', { placeholder: 'kg, pcs…' })}{f('unit_price', 'Unit price (₹) *', { type: 'number', inputMode: 'decimal', min: 0, step: 'any' })}</div>
        {taxOn && <><div className="text-muted" style={{ marginBottom: 6 }}>Tax % for this product (leave empty to use the shop default from Settings)</div>
          <div className="grid3">{f('cgst', 'CGST %', { type: 'number', step: 'any' })}{f('sgst', 'SGST %', { type: 'number', step: 'any' })}{f('igst', 'IGST %', { type: 'number', step: 'any' })}</div></>}
        {err && <div className="err-text">✕ {err}</div>}
        <div className="flex gap-2 mt-3"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save product'}</button></div>
      </div></div>}

      {preview && <div className="modal-overlay" onClick={() => setPreview(null)}><div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Ready to import</div>
        <div className="modal-subtitle">{preview.fresh} new · {preview.update} will be updated{preview.skipped ? ` · ${preview.skipped} rows skipped (missing name or price)` : ''}</div>
        <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 12 }}>{preview.rows.slice(0, 8).map(r => <div className="item-row" key={r.name}><span>{r.name} <span className="text-muted">{r.category}</span></span><b>{inr(r.unit_price)}</b></div>)}{preview.rows.length > 8 && <div className="text-muted mt-2">…and {preview.rows.length - 8} more</div>}</div>
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button><button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={doImport}>{busy ? 'Importing…' : 'Import now'}</button></div>
      </div></div>}
    </div>
  )
}
