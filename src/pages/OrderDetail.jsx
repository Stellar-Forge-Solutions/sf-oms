import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useToast } from '../components/Toast'
import ItemSheet from '../components/ItemSheet'
import NotifyModal from '../components/NotifyModal'
import TrackingModal from '../components/TrackingModal'
import DelayModal from '../components/DelayModal'
import { StageBadge, PayBadge } from '../components/Badges'
import { guardWrite, logoDataUrl, logoUrl } from '../lib/shop'
import { bluetoothPrint } from '../lib/print'
import { buildBillPdf, printNormal, balanceDue } from '../lib/billDoc'
import { calcLine, calcOrder, orderRowTotals, itemRow, inr, orderNo, fmtDate, fmtDateTime, stageIdx, nextStage, prevStage, taxActive, trackUrl, billUrl, PAY } from '../lib/orderUtils'

export default function OrderDetail() {
  const { id } = useParams(), [sp, setSp] = useSearchParams()
  const nav = useNavigate(), toast = useToast(), fileRef = useRef()
  const { shop, settings, canWrite } = useShop()
  const stages = settings.stages, f = settings.fields, tax = taxActive(settings)
  const [o, setO] = useState(null), [items, setItems] = useState([]), [events, setEvents] = useState([]), [products, setProducts] = useState([])
  const [sheet, setSheet] = useState(false), [notify, setNotify] = useState(false)
  const [trackingModal, setTrackingModal] = useState(false)
  const [delayModal, setDelayModal] = useState(false)
  const [pay, setPay] = useState('unpaid'), [paid, setPaid] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const [{ data: ord }, { data: its }, { data: ev }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
      supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
    ])
    if (!ord) return nav('/orders', { replace: true })
    setO(ord); setItems(its || []); setEvents(ev || []); setPay(ord.payment_status); setPaid(Number(ord.amount_paid) ? String(ord.amount_paid) : '')
  }, [id])
  useEffect(() => { load(); supabase.from('order_products').select('*').order('name').limit(1000).then(({ data }) => setProducts(data || [])) }, [load])
  useEffect(() => { if (o && sp.get('notify')) { setNotify(true); setSp({}, { replace: true }) } }, [o])

  if (!o) return <div className="page"><div className="empty-state">Loading…</div></div>
  const idx = stageIdx(stages, o.stage_key), next = nextStage(stages, o.stage_key), prev = prevStage(stages, o.stage_key)
  const returned = o.stage_key === 'returned'
  const staleBill = o.bill_path && o.bill_source === 'generated' && new Date(o.updated_at) - new Date(o.bill_updated_at || 0) > 2000

  // ── actions ──
  const move = async (target, trackingUrl = null) => {
    if (!guardWrite('Changing status')) return
    if (target.key === 'ready' && trackingUrl === null && o.stage_key !== 'ready') {
      return setTrackingModal(true)
    }
    setBusy('stage')
    const patch = { stage_key: target.key }
    if (trackingUrl) patch.tracking_url = trackingUrl
    let { data, error } = await supabase.from('orders').update(patch).eq('id', o.id).select().single()
    if (error && error.message?.includes('tracking_url')) {
      // If tracking_url column is not migrated yet in Supabase, update stage_key alone
      const res = await supabase.from('orders').update({ stage_key: target.key }).eq('id', o.id).select().single()
      data = res.data; error = res.error
      if (trackingUrl && !error) {
        // preserve tracking url inside order notes as fallback
        const notesWithTracking = (o.notes ? o.notes + '\n' : '') + `Tracking: ${trackingUrl}`
        await supabase.from('orders').update({ notes: notesWithTracking }).eq('id', o.id)
      }
    }
    if (error) { setBusy(''); return toast(error.message, 'error') }
    await supabase.from('order_events').insert({ order_id: o.id, shop_id: shop.id, stage_key: target.key, stage_label: target.label })
    setBusy(''); setO(data || { ...o, ...patch }); await load(); setNotify(true)
  }

  const handleTrackingSave = async (trackingUrl) => {
    setTrackingModal(false)
    const readyStage = stages.find(s => s.key === 'ready') || next
    await move(readyStage, trackingUrl || '')
  }

  const handleTrackingSkip = async () => {
    setTrackingModal(false)
    const readyStage = stages.find(s => s.key === 'ready') || next
    await move(readyStage, '')
  }

  const handleDelaySave = async ({ deliveryDate, reason }) => {
    if (!guardWrite('Updating delivery date')) return
    setBusy('delay')
    const patch = { delivery_date: deliveryDate, updated_at: new Date().toISOString() }
    let { data, error } = await supabase.from('orders').update(patch).eq('id', o.id).select().single()
    if (error && error.message?.includes('delivery_date')) {
      // fallback if column is not yet present
      const noteAppend = `Rescheduled to ${deliveryDate}${reason ? ` (${reason})` : ''}`
      const notesWithDate = (o.notes ? o.notes + '\n' : '') + noteAppend
      const res = await supabase.from('orders').update({ notes: notesWithDate, updated_at: new Date().toISOString() }).eq('id', o.id).select().single()
      data = res.data; error = res.error
    }
    if (error) { setBusy(''); return toast(error.message, 'error') }
    const eventLabel = `Delivery rescheduled to ${fmtDate(deliveryDate)}${reason ? `: ${reason}` : ''}`
    await supabase.from('order_events').insert({ order_id: o.id, shop_id: shop.id, stage_key: 'delayed', stage_label: eventLabel })
    setBusy('')
    setDelayModal(false)
    const updatedOrder = { ...(data || o), delivery_date: deliveryDate, delay_note: reason || undefined }
    setO(updatedOrder)
    await load()
    toast('Delivery date updated')
    setNotify(true)
  }

  const savePay = async () => {
    if (!guardWrite('Changing payment')) return
    if (pay === 'partial' && !(Number(paid) > 0 && Number(paid) < Number(o.total))) return toast('Enter an amount received that is less than the total', 'error')
    const amount = pay === 'paid' ? Number(o.total) : pay === 'partial' ? Number(paid) : 0
    const { error } = await supabase.from('orders').update({ payment_status: pay, amount_paid: amount, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) return toast(error.message, 'error')
    toast('Payment updated'); load()
  }

  const addItem = async (it) => {
    if (!guardWrite('Adding items')) return
    const all = [...items, it]
    const t = calcOrder(all, Number(o.freight))
    const { error } = await supabase.from('order_items').insert({ order_id: o.id, shop_id: shop.id, product_id: it.product_id || null, name: it.name, category: it.category || null, description: it.description || null, unit: it.unit || null, cgst_pct: it.cgst_pct || 0, sgst_pct: it.sgst_pct || 0, igst_pct: it.igst_pct || 0, ...itemRow(it) })
    if (error) return toast(error.message, 'error')
    const stillPaid = o.payment_status === 'paid'   // total changed: a fully-paid order becomes partly paid
    await supabase.from('orders').update({ ...orderRowTotals(t), ...(stillPaid ? { payment_status: 'partial' } : {}), updated_at: new Date().toISOString() }).eq('id', o.id)
    setSheet(false); toast(stillPaid ? 'Item added. Payment is now “Partly paid” because the total grew' : 'Item added'); load()
  }

  const hasBill = !!o.bill_path || o.bill_source === 'generated'

  const generate = async () => {
    if (!guardWrite('Generating the bill')) return
    setBusy('gen')
    try {
      // If there was an uploaded file before, remove it from storage to free space
      if (o.bill_path) await supabase.storage.from('order-bills').remove([o.bill_path])
      await supabase.from('orders').update({
        bill_path: null,
        bill_source: 'generated',
        bill_updated_at: new Date().toISOString()
      }).eq('id', o.id)
      await load()
      toast('Switched to dynamic on-demand bill (0 KB storage)')
    } catch (e) { toast('Could not update bill: ' + e.message, 'error') }
    setBusy('')
  }

  async function storeBill(blob, ext, type, source) {
    const path = `${shop.id}/${o.id}/bill-${Date.now()}.${ext}`
    const up = await supabase.storage.from('order-bills').upload(path, blob, { contentType: type })
    if (up.error) throw up.error
    const { error } = await supabase.from('orders').update({ bill_path: path, bill_source: source, bill_updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) throw error
    if (o.bill_path) await supabase.storage.from('order-bills').remove([o.bill_path])
    await load()
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!guardWrite('Uploading the bill')) return
    if (file.size > 10 * 1024 * 1024) return toast('File is too big (max 10 MB)', 'error')
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) return toast('Only PDF, JPG, and PNG files are allowed', 'error')
    setBusy('up')
    try { await storeBill(file, ext, file.type || 'application/octet-stream', 'uploaded'); toast('Bill uploaded') } catch (x) { toast('Upload failed: ' + x.message, 'error') }
    setBusy('')
  }

  const del = async () => {
    if (!guardWrite('Deleting orders')) return
    if (!confirm('Delete this order permanently?')) return
    if (o.bill_path) await supabase.storage.from('order-bills').remove([o.bill_path])
    const { error } = await supabase.from('orders').delete().eq('id', o.id)
    if (error) return toast(error.message, 'error')
    nav('/orders', { replace: true })
  }

  const thermalDefault = settings.printer_mode === 'thermal'
  const link = trackUrl(o, settings)
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('Link copied') } catch { prompt('Copy this link', text) } }

  return (
    <div className="page-wide">
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/orders')} style={{ marginBottom: 12 }}>← All orders</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{orderNo(o, settings)} · {o.customer_name}</h1>
          <p className="page-subtitle">
            {fmtDateTime(o.created_at)}
            {o.customer_whatsapp ? ` · ${o.customer_whatsapp}` : ''}
            {o.customer_email ? ` · ${o.customer_email}` : ''}
            {o.delivery_date ? ` · 📅 Delivery: ${fmtDate(o.delivery_date)}` : ''}
          </p>
          <div className="flex gap-2 mt-2">
            <StageBadge stages={stages} k={o.stage_key} />
            <PayBadge status={o.payment_status} />
            {o.delivery_date && (
              <span className="badge" style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                📅 Due {fmtDate(o.delivery_date)}
              </span>
            )}
          </div>
        </div>
        <Link to={`/orders/${o.id}/edit`} className="btn btn-secondary btn-sm">✏️ Edit order</Link>
      </div>

      {returned && <div className="hint-box" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', borderStyle: 'solid' }}>↩️ This order was returned. It is not counted in revenue. Update the payment below if you refunded the customer.</div>}

      {/* Lifecycle */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="stepper">
          {stages.map((s, i) => <div key={s.key} className={`step ${s.key === 'returned' && i === idx ? 'bad' : i < idx ? 'done' : i === idx ? 'now' : ''}`}><div className="dot">{i < idx ? '✓' : i + 1}</div>{s.label}</div>)}
        </div>
        <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
          {prev && <button className="btn btn-ghost" disabled={!!busy || !canWrite} onClick={() => move(prev)}>← Back to {prev.label}</button>}
          {next && <button className="btn btn-primary" style={{ flex: 1 }} disabled={!!busy || !canWrite} onClick={() => move(next)}>{busy === 'stage' ? 'Moving…' : `Move to ${next.label} →`}</button>}
          {o.stage_key === 'processing' && (
            <button
              className="btn btn-secondary"
              style={{ borderColor: '#f59e0b', color: '#b45309' }}
              disabled={!!busy || !canWrite}
              onClick={() => setDelayModal(true)}
            >
              ⏰ Delay order
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setNotify(true)}>🔔 Notify customer</button>
          {hasBill && (
            <a
              className="btn btn-secondary"
              href={billUrl(o, settings)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              🧾 {o.bill_source === 'uploaded' ? 'Download bill' : 'View / Download bill'}
            </a>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {/* Items */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><div className="section-title">Items</div><button className="btn btn-primary btn-sm" disabled={!canWrite} onClick={() => setSheet(true)}>+ Add product</button></div>
            <div className="items-table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    {tax && <th className="num">Tax</th>}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const l = calcLine(it)
                    return (
                      <tr key={it.id}>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="divider" style={{ marginTop: 4 }} />
            <div className="tot-row"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
            {Number(o.cgst_amt) > 0 && <div className="tot-row"><span>CGST</span><span>{inr(o.cgst_amt)}</span></div>}
            {Number(o.sgst_amt) > 0 && <div className="tot-row"><span>SGST</span><span>{inr(o.sgst_amt)}</span></div>}
            {Number(o.igst_amt) > 0 && <div className="tot-row"><span>IGST</span><span>{inr(o.igst_amt)}</span></div>}
            {Number(o.discount_amount) > 0 && (
              <div className="tot-row" style={{ color: 'var(--success)', fontWeight: 600 }}>
                <span>Discount{Number(o.discount_percent) > 0 ? ` (${Number(o.discount_percent)}%)` : ''}</span>
                <span>- {inr(o.discount_amount)}</span>
              </div>
            )}
            {Number(o.freight) > 0 && <div className="tot-row"><span>Freight / delivery</span><span>{inr(o.freight)}</span></div>}
            <div className="tot-row grand"><span>Total</span><span>{inr(o.total)}</span></div>
            {o.notes && <div className="hint-box mt-3" style={{ marginBottom: 0 }}>📝 {o.notes}</div>}
          </div>

          {/* Timeline */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>History</div>
            <div className="timeline">
              {[...events].reverse().map((e, i) => <div key={e.id} className={`tl-item ${i === 0 ? 'last' : ''}`}><b>{e.stage_label}</b><div className="text-muted" style={{ fontSize: '.78rem' }}>{fmtDateTime(e.created_at)}</div></div>)}
            </div>
          </div>
        </div>

        <div>
          {/* Payment */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Payment</div>
            <select className="form-input" value={pay} onChange={e => setPay(e.target.value)}>{Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            {pay === 'partial' && <input className="form-input mt-2" type="number" inputMode="decimal" placeholder="Amount received (₹)" value={paid} onChange={e => setPaid(e.target.value)} />}
            {o.payment_status === 'partial' && <div className="text-muted mt-2">Received {inr(o.amount_paid)} · Balance <b>{inr(balanceDue(o))}</b></div>}
            <button className="btn btn-secondary btn-full mt-3" disabled={!canWrite} onClick={savePay}>Save payment</button>
          </div>

          {/* Bill */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 4 }}>Bill</div>
            <div className="text-muted" style={{ marginBottom: 10 }}>
              {o.bill_source === 'uploaded' ? `Uploaded ${fmtDateTime(o.bill_updated_at)}` : hasBill ? `Dynamic invoice ready (0 KB storage)` : 'No bill yet'}
            </div>
            <div className="flex flex-col gap-2">
              <a className="btn btn-primary" href={billUrl(o, settings)} target="_blank" rel="noopener noreferrer">
                🧾 {hasBill ? 'View / Download bill' : 'View invoice'}
              </a>
              <button className="btn btn-secondary" disabled={!!busy || !canWrite} onClick={() => fileRef.current.click()}>
                {busy === 'up' ? 'Uploading…' : '📁 Upload physical bill / scan'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden onChange={upload} />
              {o.bill_source === 'uploaded' && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--teal-dark)' }} disabled={!!busy || !canWrite} onClick={generate}>
                  ⚡ Switch back to auto-generated bill (free storage)
                </button>
              )}
            </div>
            <div className="divider" />
            <div className="text-muted" style={{ marginBottom: 8 }}>Print</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button className={`btn btn-sm ${thermalDefault ? 'btn-dark' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => bluetoothPrint(o)}>🖨️ Thermal printer</button>
              <button className={`btn btn-sm ${!thermalDefault ? 'btn-dark' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => printNormal({ order: o, items, shop, settings, logoUrl: logoUrl(shop) })}>📄 Normal printer</button>
            </div>
            <Link to="/connect-printer" className="text-muted" style={{ display: 'block', marginTop: 8, fontSize: '.78rem' }}>How do I connect a thermal printer?</Link>
          </div>

          {/* Tracking */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Customer tracking link</div>
            <div className="mono" style={{ fontSize: '.72rem', wordBreak: 'break-all', color: 'var(--text-muted)', marginBottom: 10 }}>{link}</div>
            <div className="flex gap-2"><button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => copy(link)}>Copy link</button><a className="btn btn-secondary btn-sm" style={{ flex: 1 }} href={link} target="_blank" rel="noopener noreferrer">Open</a></div>
          </div>

          <button className="btn btn-ghost btn-full btn-sm" style={{ color: 'var(--danger)' }} onClick={del}>Delete order</button>
        </div>
      </div>

      {sheet && <ItemSheet item={null} products={products} settings={settings} onSave={addItem} onClose={() => setSheet(false)} />}
      {trackingModal && (
        <TrackingModal
          order={o}
          onSave={handleTrackingSave}
          onSkip={handleTrackingSkip}
          onClose={() => setTrackingModal(false)}
        />
      )}
      {delayModal && (
        <DelayModal
          order={o}
          onSave={handleDelaySave}
          onClose={() => setDelayModal(false)}
        />
      )}
      {notify && <NotifyModal order={o} settings={settings} shop={shop} onClose={() => setNotify(false)} />}
    </div>
  )
}
