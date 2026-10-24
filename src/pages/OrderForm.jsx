import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import ItemSheet from '../components/ItemSheet'
import SpeedDialPicker from '../components/SpeedDialPicker'
import { guardWrite, logoDataUrl } from '../lib/shop'
import { buildBillPdf } from '../lib/billDoc'
import { calcLine, calcOrder, orderRowTotals, itemRow, inr, r2, digits10, taxActive, PAY } from '../lib/orderUtils'
import { upgradeUrl } from '../lib/planHelper'

// One screen for both "new order" and "edit order". Fields shown depend on Settings.
export default function OrderForm() {
  const { id } = useParams()
  const nav = useNavigate(), toast = useToast()
  const { shop, settings, plan, monthlyUsage } = useShop(), { user } = useAuth()
  const f = settings.fields, tax = taxActive(settings)
  const [c, setC] = useState({ name: '', whatsapp: '', email: '' })
  const [items, setItems] = useState([])
  const [freight, setFreight] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [discountAmt, setDiscountAmt] = useState('')
  const [discountMode, setDiscountMode] = useState('pct')
  const [notes, setNotes] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [pay, setPay] = useState('unpaid'), [paid, setPaid] = useState('')
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [sheet, setSheet] = useState(null)       // null | { index, item }
  const [billOption, setBillOption] = useState('none') // 'none' | 'generate' | 'upload'
  const [billFile, setBillFile] = useState(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!id), [err, setErr] = useState('')
  const [overageConfirmed, setOverageConfirmed] = useState(false)

  useEffect(() => {
    supabase.from('order_products').select('*').order('name').limit(1000).then(({ data }) => setProducts(data || []))

    ;(async () => {
      const custMap = new Map()
      try {
        const { data: cData } = await supabase.from('order_customers').select('*').order('name').limit(1000)
        ;(cData || []).forEach(x => {
          const k = (x.name || '').trim().toLowerCase()
          if (k) custMap.set(k, x)
        })
      } catch {}
      try {
        const { data: oData } = await supabase.from('orders').select('customer_name, customer_whatsapp, customer_email').order('created_at', { ascending: false }).limit(200)
        ;(oData || []).forEach(o => {
          const k = (o.customer_name || '').trim().toLowerCase()
          if (k && !custMap.has(k)) {
            custMap.set(k, { name: o.customer_name.trim(), whatsapp: o.customer_whatsapp || '', email: o.customer_email || '' })
          }
        })
      } catch {}
      setCustomers([...custMap.values()])
    })()

    if (!id) return
    ;(async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
      ])
      if (!o) return nav('/orders', { replace: true })
      setC({ name: o.customer_name, whatsapp: o.customer_whatsapp || '', email: o.customer_email || '' })
      setItems((its || []).map(i => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })))
      setFreight(Number(o.freight) ? String(o.freight) : '')
      setDiscountPct(Number(o.discount_percent) ? String(o.discount_percent) : '')
      setDiscountAmt(Number(o.discount_amount) ? String(o.discount_amount) : '')
      setDeliveryDate(o.delivery_date ? String(o.delivery_date).split('T')[0] : '')
      setNotes(o.notes || ''); setPay(o.payment_status); setPaid(Number(o.amount_paid) ? String(o.amount_paid) : '')
      setLoading(false)
    })()
  }, [id])

  const preDiscountTotal = r2(items.reduce((acc, it) => acc + calcLine(it).total, 0))

  const handlePctChange = (val) => {
    setDiscountMode('pct')
    setDiscountPct(val)
    if (val === '' || isNaN(Number(val)) || Number(val) === 0) {
      setDiscountAmt('')
      return
    }
    const pct = Math.min(100, Math.max(0, Number(val)))
    const amt = r2((preDiscountTotal * pct) / 100)
    setDiscountAmt(amt > 0 ? String(amt) : '')
  }

  const handleAmtChange = (val) => {
    setDiscountMode('amt')
    setDiscountAmt(val)
    if (val === '' || isNaN(Number(val)) || Number(val) === 0) {
      setDiscountPct('')
      return
    }
    const amt = Math.max(0, Number(val))
    const pct = preDiscountTotal > 0 ? r2((amt / preDiscountTotal) * 100) : 0
    setDiscountPct(pct > 0 ? String(pct) : '')
  }

  useEffect(() => {
    if (discountMode === 'pct' && discountPct && Number(discountPct) > 0) {
      const pct = Math.min(100, Math.max(0, Number(discountPct)))
      const amt = r2((preDiscountTotal * pct) / 100)
      setDiscountAmt(amt > 0 ? String(amt) : '')
    } else if (discountMode === 'amt' && discountAmt && Number(discountAmt) > 0) {
      const amt = Math.max(0, Number(discountAmt))
      const pct = preDiscountTotal > 0 ? r2((amt / preDiscountTotal) * 100) : 0
      setDiscountPct(pct > 0 ? String(pct) : '')
    }
  }, [items])

  const totals = calcOrder(items, f.freight ? Number(freight) || 0 : 0, Number(discountAmt) || 0)
  const setItem = (it) => {
    setItems(list => sheet.index === null ? [...list, it] : list.map((x, i) => i === sheet.index ? it : x))
    setSheet(null)
    if (it.name?.trim()) {
      setProducts(prev => {
        if (prev.some(p => p.name.toLowerCase() === it.name.trim().toLowerCase())) return prev
        return [...prev, { name: it.name.trim(), category: it.category || null, unit: it.unit || null, unit_price: it.unit_price }]
      })
    }
  }

  const save = async () => {
    setErr('')
    if (!id && monthlyUsage?.isOverageBlocked) {
      return setErr(`Monthly overage spending limit of ${inr(monthlyUsage.overageLimit)} reached. Increase your limit on the Billing page or upgrade your plan to create new orders.`)
    }
    if (!c.name.trim()) return setErr('Customer name is required')
    if (c.whatsapp && digits10(c.whatsapp).length !== 10) return setErr('WhatsApp number should have 10 digits (or leave it empty)')
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) return setErr('Email looks wrong (or leave it empty)')
    if (!items.length) return setErr('Add at least one item')
    if (pay === 'partial' && !(Number(paid) > 0 && Number(paid) < totals.total)) return setErr('For partly paid, enter an amount received that is less than the total')
    if (!guardWrite('Saving orders')) return
    setBusy(true)

    const effPct = Number(discountPct) || 0
    const effAmt = totals.discount || 0
    const row = {
      customer_name: c.name.trim(), customer_whatsapp: c.whatsapp ? digits10(c.whatsapp) : null, customer_email: c.email.trim().toLowerCase() || null,
      payment_status: pay, amount_paid: pay === 'paid' ? totals.total : pay === 'partial' ? Number(paid) : 0,
      notes: f.notes ? notes.trim() || null : null, discount_percent: effPct, discount_amount: effAmt,
      delivery_date: deliveryDate ? deliveryDate : null,
      ...orderRowTotals(totals, effPct), updated_at: new Date().toISOString(),
    }
    let orderId = id
    let createdOrder = null
    if (id) {
      let { error } = await supabase.from('orders').update(row).eq('id', id)
      if (error && (error.message?.includes('discount_percent') || error.message?.includes('discount_amount') || error.message?.includes('delivery_date'))) {
        const fallback = { ...row }
        if (error.message?.includes('discount_percent') || error.message?.includes('discount_amount')) {
          delete fallback.discount_percent; delete fallback.discount_amount
        }
        if (error.message?.includes('delivery_date')) {
          delete fallback.delivery_date
          if (deliveryDate) {
            fallback.notes = (fallback.notes ? fallback.notes + '\n' : '') + `Delivery Date: ${deliveryDate}`
          }
        }
        error = (await supabase.from('orders').update(fallback).eq('id', id)).error
      }
      if (error) { setBusy(false); return setErr(error.message) }
      await supabase.from('order_items').delete().eq('order_id', id)
    } else {
      const first = settings.stages[0]
      let { data, error } = await supabase.from('orders').insert({ ...row, shop_id: shop.id, stage_key: first.key, created_by: user.email }).select().single()
      if (error && (error.message?.includes('discount_percent') || error.message?.includes('discount_amount') || error.message?.includes('delivery_date'))) {
        const fallback = { ...row }
        if (error.message?.includes('discount_percent') || error.message?.includes('discount_amount')) {
          delete fallback.discount_percent; delete fallback.discount_amount
        }
        if (error.message?.includes('delivery_date')) {
          delete fallback.delivery_date
          if (deliveryDate) {
            fallback.notes = (fallback.notes ? fallback.notes + '\n' : '') + `Delivery Date: ${deliveryDate}`
          }
        }
        const res = await supabase.from('orders').insert({ ...fallback, shop_id: shop.id, stage_key: first.key, created_by: user.email }).select().single()
        data = res.data; error = res.error
      }
      if (error) { setBusy(false); return setErr(error.message) }
      orderId = data.id
      createdOrder = data
      await supabase.from('order_events').insert({ order_id: orderId, shop_id: shop.id, stage_key: first.key, stage_label: first.label })
    }
    const lines = items.map(it => ({
      order_id: orderId, shop_id: shop.id, product_id: it.product_id || null, name: it.name, category: it.category || null, description: it.description || null, unit: it.unit || null,
      cgst_pct: it.cgst_pct || 0, sgst_pct: it.sgst_pct || 0, igst_pct: it.igst_pct || 0, ...itemRow(it),
    }))
    const { error: ie } = await supabase.from('order_items').insert(lines)
    if (ie) { setBusy(false); return setErr(ie.message) }

    // Autosave customer details
    try {
      const custName = c.name.trim()
      const foundCust = customers.find(x => x.name.toLowerCase() === custName.toLowerCase())
      const cData = {
        name: custName,
        whatsapp: c.whatsapp ? digits10(c.whatsapp) : null,
        email: c.email.trim().toLowerCase() || null,
        shop_id: shop.id,
      }
      if (foundCust?.id && !String(foundCust.id).startsWith('ord-')) {
        await supabase.from('order_customers').update(cData).eq('id', foundCust.id)
      } else {
        await supabase.from('order_customers').insert(cData)
      }
    } catch {}

    // Autosave products and categories
    try {
      for (const it of items) {
        if (!it.name?.trim()) continue
        const itName = it.name.trim()
        const foundProd = products.find(p => p.name.toLowerCase() === itName.toLowerCase())
        const pData = {
          name: itName,
          category: it.category?.trim() || null,
          unit: it.unit?.trim() || null,
          unit_price: Number(it.unit_price) || 0,
          cgst: it.cgst_pct ? Number(it.cgst_pct) : null,
          sgst: it.sgst_pct ? Number(it.sgst_pct) : null,
          igst: it.igst_pct ? Number(it.igst_pct) : null,
        }
        pData.total_price = r2(pData.unit_price * (1 + ((pData.cgst || 0) + (pData.sgst || 0) + (pData.igst || 0)) / 100))

        if (foundProd?.id) {
          if (it.category && !foundProd.category) {
            await supabase.from('order_products').update({ category: it.category.trim() }).eq('id', foundProd.id)
          }
        } else {
          await supabase.from('order_products').insert({ ...pData, shop_id: shop.id })
        }
      }
    } catch {}

    // Bill generation or upload (if selected on new order)
    if (!id && billOption !== 'none') {
      try {
        if (billOption === 'generate') {
          // Zero-storage dynamic generation: simply mark bill_source as generated (no PDF or storage upload needed)
          await supabase.from('orders').update({
            bill_source: 'generated',
            bill_updated_at: new Date().toISOString()
          }).eq('id', orderId)
        } else if (billOption === 'upload' && billFile) {
          const ext = (billFile.name.split('.').pop() || 'pdf').toLowerCase()
          const path = `${shop.id}/${orderId}/bill-${Date.now()}.${ext}`
          const up = await supabase.storage.from('order-bills').upload(path, billFile, { contentType: billFile.type || 'application/octet-stream' })
          if (!up.error) {
            await supabase.from('orders').update({ bill_path: path, bill_source: 'uploaded', bill_updated_at: new Date().toISOString() }).eq('id', orderId)
          }
        }
      } catch (be) {
        console.error('Bill processing error on order creation:', be)
      }
    }

    setBusy(false)
    toast(id ? 'Order updated' : (billOption === 'generate' ? 'Order created & bill generated' : (billOption === 'upload' && billFile ? 'Order created & bill attached' : 'Order created')))
    nav(`/orders/${orderId}${id ? '' : '?notify=1'}`, { replace: true })
  }

  const custQuery = (c.name || '').trim().toLowerCase()
  const customerSuggestions = (custQuery
    ? customers.filter(x => x.name.toLowerCase().includes(custQuery))
    : customers
  ).slice(0, 8)
  const pickCustomer = (cust) => {
    setC({
      name: cust.name,
      whatsapp: cust.whatsapp || '',
      email: cust.email || '',
    })
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 12 }}>← Back</button>
      <h1 className="page-title">{id ? 'Edit order' : 'New order'}</h1>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>{id ? 'Change customer, items or payment.' : `It will start in “${settings.stages[0].label}”.`}</p>

      {/* 80% non-blocking inline warning for new orders */}
      {!id && monthlyUsage?.isNearLimit && (
        <div className="hint-box" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <b>Approaching included orders limit:</b> You have used {monthlyUsage.used} of {monthlyUsage.included} orders this month ({monthlyUsage.pctUsed}%).
            </div>
            <Link to="/billing" className="btn btn-sm btn-secondary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View plans / Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Overage spending limit blocked state */}
      {!id && monthlyUsage?.isOverageBlocked && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fca5a5', marginBottom: 16, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚠️</div>
          <h3 style={{ color: '#991b1b', margin: '0 0 8px' }}>Monthly Overage Limit Reached</h3>
          <p style={{ color: '#7f1d1d', fontSize: '.88rem', lineHeight: 1.5, maxWidth: 500, margin: '0 auto 16px' }}>
            You have reached your shop's monthly overage spending limit of <b>{inr(monthlyUsage.overageLimit)}</b>.
            New order creation is currently paused to prevent extra charges. Your existing orders remain viewable and editable.
          </p>
          <div className="flex gap-2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/billing" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Increase Limit or Upgrade Plan
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/orders')}>
              Go to Orders
            </button>
          </div>
        </div>
      )}

      {/* 100% Inline confirmation screen before creating an overage order */}
      {!id && monthlyUsage?.isAtLimit && !monthlyUsage?.isOverageBlocked && !overageConfirmed && (
        <div className="card" style={{ background: '#fffbeb', borderColor: '#fcd34d', marginBottom: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: '1.4rem' }}>ℹ️</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px', color: '#78350f', fontSize: '1rem' }}>
                You've used all {monthlyUsage.included} included orders this month
              </h3>
              <p style={{ margin: '0 0 14px', color: '#92400e', fontSize: '.85rem', lineHeight: 1.5 }}>
                Extra orders cost <b>₹0.30 each</b> (metered overage) and will be billed at the end of the month.
                You can also upgrade to <b>Basic (₹29/month)</b> for 300 orders/month and an ad-free experience.
              </p>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setOverageConfirmed(true)}
                >
                  Continue creating order (₹0.30)
                </button>
                <a
                  className="btn btn-secondary btn-sm"
                  href={upgradeUrl(shop, user, 'basic')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  ⭐ Upgrade to Basic (₹29/mo)
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => nav(-1)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Customer</div>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" placeholder="e.g. Ravi Kumar" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} />
          {customerSuggestions.length > 0 && (
            <div className="suggestion-wrap">
              <div className="suggestion-label">{custQuery ? 'Matching customers' : 'Recent customers'}</div>
              <div className="suggestion-pills">
                {customerSuggestions.map((cust, i) => (
                  <button key={cust.id || cust.name || i} type="button" className="suggestion-pill" onClick={() => pickCustomer(cust)}>
                    {cust.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid2">
          <div className="form-group"><label className="form-label">WhatsApp (optional)</label><input className="form-input" inputMode="numeric" placeholder="10-digit number" value={c.whatsapp} onChange={e => setC({ ...c, whatsapp: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" type="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} /></div>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">Expected Delivery Date (optional)</label>
          <input className="form-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><div className="section-title">Items</div>
          <button className="btn btn-primary btn-sm" onClick={() => setSheet({ index: null, item: null })}>+ Add item</button></div>

        {f.speed_dial && (
          <SpeedDialPicker
            products={products}
            settings={settings}
            onAdd={(newItem) => setItems([...items, newItem])}
          />
        )}

        {!items.length && <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-text">No items yet. Tap “Add item”{f.speed_dial ? ' or pick from Speed Dial above' : ''}.</div></div>}
        {items.length > 0 && (
          <div className="items-table-wrap">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  {tax && <th className="num">Tax</th>}
                  <th className="num">Total</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const l = calcLine(it)
                  return (
                    <tr key={i}>
                      <td>
                        <b>{it.name}</b>
                        {((f.category && it.category) || (f.description && it.description)) && (
                          <div className="text-muted" style={{ fontSize: '.75rem', marginTop: 2 }}>
                            {f.category && it.category ? it.category : ''}
                            {f.category && it.category && f.description && it.description ? ' · ' : ''}
                            {f.description && it.description ? it.description : ''}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        {Number(it.quantity)}{f.unit && it.unit ? ' ' + it.unit : ''}
                      </td>
                      <td className="num">{inr(it.unit_price)}</td>
                      {tax && <td className="num">{l.tax > 0 ? inr(l.tax) : '–'}</td>}
                      <td className="num"><b>{inr(l.total)}</b></td>
                      <td className="num">
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', minHeight: 30, fontSize: '.75rem' }} onClick={() => setSheet({ index: i, item: it })}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 8px', minHeight: 30, fontSize: '.75rem' }} onClick={() => setItems(items.filter((_, n) => n !== i))}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="grid2">
          <div className="form-group">
            <label className="form-label">Discount (%)</label>
            <input
              className="form-input"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="any"
              placeholder="0"
              value={discountPct}
              onChange={e => handlePctChange(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Discount (₹)</label>
            <input
              className="form-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0"
              value={discountAmt}
              onChange={e => handleAmtChange(e.target.value)}
            />
          </div>
        </div>

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
        {totals.discount > 0 && (
          <div className="tot-row" style={{ color: 'var(--success)', fontWeight: 600 }}>
            <span>Discount{Number(discountPct) > 0 ? ` (${Number(discountPct)}%)` : ''}</span>
            <span>- {inr(totals.discount)}</span>
          </div>
        )}
        {totals.freight > 0 && <div className="tot-row"><span>Freight / delivery</span><span>{inr(totals.freight)}</span></div>}
        <div className="tot-row grand"><span>Total</span><span>{inr(totals.total)}</span></div>
      </div>

      {!id && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>Bill (Invoice)</div>
          <p className="text-muted" style={{ fontSize: '.8rem', marginBottom: 12 }}>
            Optionally generate an instant PDF bill or attach an existing bill photo/PDF for this order.
          </p>

          <div className="seg" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={billOption === 'none' ? 'on' : ''}
              onClick={() => { setBillOption('none'); setBillFile(null) }}
            >
              Later
            </button>
            <button
              type="button"
              className={billOption === 'generate' ? 'on' : ''}
              onClick={() => { setBillOption('generate'); setBillFile(null) }}
            >
              ⚡ Auto-generate
            </button>
            <button
              type="button"
              className={billOption === 'upload' ? 'on' : ''}
              onClick={() => setBillOption('upload')}
            >
              📁 Upload bill
            </button>
          </div>

          {billOption === 'generate' && (
            <div className="hint-box" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', marginBottom: 0 }}>
              ✓ A clean invoice with shop logo, items breakdown, and QR code will be generated on demand. Zero storage used.
            </div>
          )}

          {billOption === 'upload' && (
            <div style={{ marginTop: 8 }}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const ext = (f.name.split('.').pop() || '').toLowerCase()
                    const allowed = ['pdf', 'jpg', 'jpeg', 'png']
                    if (!allowed.includes(ext)) {
                      toast('Only PDF, JPG, and PNG files are allowed', 'error')
                      e.target.value = ''
                      setBillFile(null)
                      return
                    }
                    if (f.size > 10 * 1024 * 1024) {
                      toast('File is too big (max 10 MB)', 'error')
                      e.target.value = ''
                      setBillFile(null)
                      return
                    }
                    setBillFile(f)
                  }
                }}
              />
              {billFile && (
                <div className="text-muted" style={{ fontSize: '.78rem', marginTop: 6, color: 'var(--teal-dark)' }}>
                  Selected: <b>{billFile.name}</b> ({(billFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {err && <div className="err-text" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={save}
        disabled={busy || (!id && monthlyUsage?.isOverageBlocked) || (!id && monthlyUsage?.isAtLimit && !overageConfirmed)}
      >
        {busy ? 'Saving…' : id ? 'Save changes' : (!id && monthlyUsage?.isAtLimit && !overageConfirmed) ? 'Confirm Overage to Create' : 'Create order'}
      </button>

      {sheet && <ItemSheet item={sheet.item} products={products} settings={settings} onSave={setItem} onClose={() => setSheet(null)} />}
    </div>
  )
}
