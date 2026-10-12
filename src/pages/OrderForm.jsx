import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import ItemSheet from '../components/ItemSheet'
import { guardWrite } from '../lib/shop'
import { calcLine, calcOrder, orderRowTotals, itemRow, inr, digits10, taxActive, PAY } from '../lib/orderUtils'

// One screen for both "new order" and "edit order". Fields shown depend on Settings.
export default function OrderForm() {
  const { id } = useParams()
  const nav = useNavigate(), toast = useToast()
  const { shop, settings } = useShop(), { user } = useAuth()
  const f = settings.fields, tax = taxActive(settings)
  const [c, setC] = useState({ name: '', whatsapp: '', email: '' })
  const [items, setItems] = useState([])
  const [freight, setFreight] = useState('')
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState('unpaid'), [paid, setPaid] = useState('')
  const [products, setProducts] = useState([])
  const [sheet, setSheet] = useState(null)       // null | { index, item }
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!id), [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('order_products').select('*').order('name').limit(1000).then(({ data }) => setProducts(data || []))
    if (!id) return
    ;(async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
      ])
      if (!o) return nav('/orders', { replace: true })
      setC({ name: o.customer_name, whatsapp: o.customer_whatsapp || '', email: o.customer_email || '' })
      setItems((its || []).map(i => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })))
      setFreight(Number(o.freight) ? String(o.freight) : ''); setNotes(o.notes || ''); setPay(o.payment_status); setPaid(Number(o.amount_paid) ? String(o.amount_paid) : '')
      setLoading(false)
    })()
  }, [id])

  const totals = calcOrder(items, f.freight ? Number(freight) || 0 : 0)
  const setItem = (it) => { setItems(list => sheet.index === null ? [...list, it] : list.map((x, i) => i === sheet.index ? it : x)); setSheet(null) }

  const save = async () => {
    setErr('')
    if (!c.name.trim()) return setErr('Customer name is required')
    if (c.whatsapp && digits10(c.whatsapp).length !== 10) return setErr('WhatsApp number should have 10 digits (or leave it empty)')
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) return setErr('Email looks wrong (or leave it empty)')
    if (!items.length) return setErr('Add at least one item')
    if (pay === 'partial' && !(Number(paid) > 0 && Number(paid) < totals.total)) return setErr('For partly paid, enter an amount received that is less than the total')
    if (!guardWrite('Saving orders')) return
    setBusy(true)

    const row = {
      customer_name: c.name.trim(), customer_whatsapp: c.whatsapp ? digits10(c.whatsapp) : null, customer_email: c.email.trim().toLowerCase() || null,
      payment_status: pay, amount_paid: pay === 'paid' ? totals.total : pay === 'partial' ? Number(paid) : 0,
      notes: f.notes ? notes.trim() || null : null, ...orderRowTotals(totals), updated_at: new Date().toISOString(),
    }
    let orderId = id
    if (id) {
      const { error } = await supabase.from('orders').update(row).eq('id', id)
      if (error) { setBusy(false); return setErr(error.message) }
      await supabase.from('order_items').delete().eq('order_id', id)
    } else {
      const first = settings.stages[0]
      const { data, error } = await supabase.from('orders').insert({ ...row, shop_id: shop.id, stage_key: first.key, created_by: user.email }).select().single()
      if (error) { setBusy(false); return setErr(error.message) }
      orderId = data.id
      await supabase.from('order_events').insert({ order_id: orderId, shop_id: shop.id, stage_key: first.key, stage_label: first.label })
    }
    const lines = items.map(it => ({
      order_id: orderId, shop_id: shop.id, product_id: it.product_id || null, name: it.name, category: it.category || null, description: it.description || null, unit: it.unit || null,
      cgst_pct: it.cgst_pct || 0, sgst_pct: it.sgst_pct || 0, igst_pct: it.igst_pct || 0, ...itemRow(it),
    }))
    const { error: ie } = await supabase.from('order_items').insert(lines)
    setBusy(false)
    if (ie) return setErr(ie.message)
    toast(id ? 'Order updated' : 'Order created')
    nav(`/orders/${orderId}${id ? '' : '?notify=1'}`, { replace: true })
  }

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 12 }}>← Back</button>
      <h1 className="page-title">{id ? 'Edit order' : 'New order'}</h1>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>{id ? 'Change customer, items or payment.' : `It will start in “${settings.stages[0].label}”.`}</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Customer</div>
        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></div>
        <div className="grid2">
          <div className="form-group"><label className="form-label">WhatsApp (optional)</label><input className="form-input" inputMode="numeric" placeholder="10-digit number" value={c.whatsapp} onChange={e => setC({ ...c, whatsapp: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" type="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><div className="section-title">Items</div>
          <button className="btn btn-primary btn-sm" onClick={() => setSheet({ index: null, item: null })}>+ Add item</button></div>
        {!items.length && <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-text">No items yet. Tap “Add item”.</div></div>}
        {items.map((it, i) => { const l = calcLine(it); return (
          <div className="item-row" key={i}>
            <div style={{ minWidth: 0 }}>
              <b>{it.name}</b>
              <div className="text-muted" style={{ fontSize: '.78rem' }}>
                {Number(it.quantity)}{f.unit && it.unit ? ' ' + it.unit : ''} × {inr(it.unit_price)}{f.category && it.category ? ` · ${it.category}` : ''}{tax && l.tax > 0 ? ` · tax ${inr(l.tax)}` : ''}
              </div>
              {f.description && it.description && <div className="text-muted" style={{ fontSize: '.78rem' }}>{it.description}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <b>{inr(l.total)}</b>
              <div className="flex gap-2 mt-1" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setSheet({ index: i, item: it })}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setItems(items.filter((_, n) => n !== i))}>Delete</button>
              </div>
            </div>
          </div>) })}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        {f.freight && <div className="form-group"><label className="form-label">Freight / delivery charges (₹)</label><input className="form-input" type="number" inputMode="decimal" min="0" step="any" value={freight} onChange={e => setFreight(e.target.value)} placeholder="0" /></div>}
        {f.notes && <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} /></div>}
        <div className="form-group"><label className="form-label">Payment</label>
          <select className="form-input" value={pay} onChange={e => setPay(e.target.value)}>{Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        {pay === 'partial' && <div className="form-group"><label className="form-label">Amount received (₹)</label><input className="form-input" type="number" inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} /></div>}

        <div className="divider" />
        <div className="tot-row"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
        {totals.cgst > 0 && <div className="tot-row"><span>CGST</span><span>{inr(totals.cgst)}</span></div>}
        {totals.sgst > 0 && <div className="tot-row"><span>SGST</span><span>{inr(totals.sgst)}</span></div>}
        {totals.igst > 0 && <div className="tot-row"><span>IGST</span><span>{inr(totals.igst)}</span></div>}
        {totals.freight > 0 && <div className="tot-row"><span>Freight / delivery</span><span>{inr(totals.freight)}</span></div>}
        <div className="tot-row grand"><span>Total</span><span>{inr(totals.total)}</span></div>
      </div>

      {err && <div className="err-text" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <button className="btn btn-primary btn-full btn-lg" onClick={save} disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create order'}</button>

      {sheet && <ItemSheet item={sheet.item} products={products} settings={settings} onSave={setItem} onClose={() => setSheet(null)} />}
    </div>
  )
}
