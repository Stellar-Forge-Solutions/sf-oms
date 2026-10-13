import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PAY, inr, fmtDateTime, stageIdx, waNumber } from '../lib/orderUtils'

// PUBLIC page (no login). Timeline first, then items, totals, payment and the bill download.
export default function TrackPage() {
  const { token } = useParams()
  const [d, setD] = useState(null), [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/track?t=${token}`).then(async r => { const j = await r.json().catch(() => ({})); r.ok ? setD(j) : setErr(j.error || 'Order not found') }).catch(() => setErr('Could not load. Please check your connection.'))
  }, [token])

  if (err) return <Shell><div className="card empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">{err}</div><div className="empty-state-text">Please check the link, or contact the shop that sent it.</div></div></Shell>
  if (!d) return <Shell><div className="empty-state">Loading your order…</div></Shell>

  const { shop, brand, stages, order: o, items, events, fields } = d
  const color = /^#[0-9a-f]{6}$/i.test(brand.color || '') ? brand.color : '#00c9a7'
  const idx = stageIdx(stages, o.stage_key)
  const when = (key) => { const e = [...events].reverse().find(x => x.stage_key === key); return e ? fmtDateTime(e.created_at) : '' }
  const p = PAY[o.payment_status]
  const showTax = Number(o.cgst_amt) + Number(o.sgst_amt) + Number(o.igst_amt) > 0
  const wa = waNumber(shop.whatsapp || shop.mobile)

  const currentStage = stages[idx] || stages[0]
  const isReturned = o.stage_key === 'returned'

  return (
    <Shell brand={brand}>
      {/* ── Shop Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {shop.logo && <img src={shop.logo} alt="" style={{ height: 56, marginBottom: 8, objectFit: 'contain' }} />}
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)' }}>{shop.name}</div>
        {shop.tagline && <div className="text-muted" style={{ fontSize: '.84rem', marginTop: 2 }}>{shop.tagline}</div>}
      </div>

      {/* ── Hero Status Card ── */}
      <div className="track-hero" style={{ borderTop: `4px solid ${isReturned ? 'var(--danger)' : color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Order Tracking</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ink)', margin: '2px 0 4px' }}>{o.no}</div>
            <div className="text-muted" style={{ fontSize: '.8rem' }}>Placed on {fmtDateTime(o.created_at)}</div>
          </div>
          <div
            className="track-hero-badge"
            style={{
              background: isReturned ? '#fee2e2' : `${color}20`,
              color: isReturned ? '#991b1b' : color,
              border: `1px solid ${isReturned ? '#fca5a5' : color}`,
            }}
          >
            <span className="track-pulse-dot" />
            {currentStage?.label || 'In Progress'}
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="stepper" style={{ marginTop: 20, marginBottom: 10 }}>
          {stages.filter(s => s.key !== 'returned').map((s, i) => {
            const isDone = i <= idx
            const isNow = i === idx
            return (
              <div key={s.key} className={`step ${isDone ? 'done' : ''} ${isNow ? 'now' : ''}`}>
                <div className="dot" style={isDone ? { background: color, color: '#fff' } : {}}>
                  {isDone ? '✓' : i + 1}
                </div>
                <div style={{ fontWeight: isNow ? 700 : 500 }}>{s.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Courier / Shipping Card (If tracking link available) ── */}
      {o.tracking_url && (
        <div className="track-courier-card">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '.92rem', color: '#0f172a' }}>
              <span>🚚</span> Courier Tracking
            </div>
            <div className="text-muted" style={{ fontSize: '.78rem', marginTop: 2, wordBreak: 'break-all' }}>
              Your order has been dispatched via courier partner.
            </div>
          </div>
          <a
            className="track-courier-btn"
            href={o.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Track Parcel ↗
          </a>
        </div>
      )}

      {/* ── Items Breakdown ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Order Items ({items.length})</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                {showTax && <th className="num">Tax</th>}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <b>{it.name}</b>
                    {((fields.category && it.category) || (fields.description && it.description)) && (
                      <div className="text-muted" style={{ fontSize: '.75rem', marginTop: 2 }}>
                        {fields.category && it.category ? it.category : ''}
                        {fields.category && it.category && fields.description && it.description ? ' · ' : ''}
                        {fields.description && it.description ? it.description : ''}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {Number(it.quantity)}{fields.unit && it.unit ? ' ' + it.unit : ''}
                  </td>
                  <td className="num">{inr(it.unit_price)}</td>
                  {showTax && <td className="num">{Number(it.tax_amt) > 0 ? inr(it.tax_amt) : '–'}</td>}
                  <td className="num"><b>{inr(Number(it.line_total) + Number(it.tax_amt))}</b></td>
                </tr>
              ))}
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
        <div className="tot-row" style={{ alignItems: 'center', marginTop: 8 }}>
          <span>Payment Status</span>
          <span className="badge" style={{ background: p.bg, color: p.fg }}>
            {p.label}{o.payment_status === 'partial' ? ` · ${inr(o.amount_paid)} received` : ''}
          </span>
        </div>
      </div>

      {/* ── Official Invoice / Bill Download ── */}
      {o.has_bill && (
        <div className="track-invoice-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: '.92rem', color: '#065f46' }}>
              📄 Official Tax Invoice
            </div>
            <div style={{ fontSize: '.78rem', color: '#047857', marginTop: 2 }}>
              Your bill has been generated and is ready to download.
            </div>
          </div>
          <a
            className="btn btn-sm btn-primary"
            style={{ textDecoration: 'none', background: '#059669', color: '#fff', border: 'none' }}
            href={`/api/bill?t=${token}`}
          >
            ⬇️ Download PDF
          </a>
        </div>
      )}

      {/* ── Detailed Timeline ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Status Timeline</div>
        <div className="timeline" style={{ borderLeftColor: 'transparent', position: 'relative' }}>
          {stages.map((s, i) => {
            const done = i <= idx, now = i === idx, bad = s.key === 'returned' && now
            const c = bad ? '#ef4444' : color
            return (
              <div key={s.key} style={{ position: 'relative', paddingBottom: i === stages.length - 1 ? 0 : 20, paddingLeft: 6 }}>
                {i < stages.length - 1 && <span style={{ position: 'absolute', left: -9, top: 18, bottom: -2, width: 3, background: i < idx ? color : 'var(--border)', borderRadius: 3 }} />}
                <span style={{ position: 'absolute', left: -15, top: 2, width: 15, height: 15, borderRadius: '50%', background: done ? c : 'var(--white)', border: `3px solid ${done ? c : 'var(--border)'}`, boxShadow: now ? `0 0 0 5px ${c}30` : 'none' }} />
                <div style={{ fontWeight: now ? 700 : 500, color: done ? 'var(--ink)' : 'var(--text-muted)', fontSize: now ? '1.02rem' : '.92rem' }}>
                  {s.label}{now && <span style={{ marginLeft: 8, fontSize: '.68rem', background: c, color: '#fff', borderRadius: 99, padding: '2px 8px', verticalAlign: 'middle' }}>{bad ? 'Returned' : 'Current'}</span>}
                </div>
                {done && <div className="text-muted" style={{ fontSize: '.76rem' }}>{when(s.key)}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Shop Details & Support ── */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: 4 }}>
          {shop.thank_you || 'Thank you for your order!'}
        </div>
        {shop.address && <div className="text-muted" style={{ fontSize: '.84rem', marginBottom: 4 }}>{shop.address}</div>}
        {shop.gst_no && <div className="text-muted" style={{ fontSize: '.76rem', marginBottom: 8 }}>GSTIN: {shop.gst_no}</div>}
        <div className="flex gap-2 mt-3" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {shop.mobile && <a className="btn btn-secondary btn-sm" href={`tel:${shop.mobile}`}>📞 Call</a>}
          {wa && <a className="btn btn-secondary btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
          {shop.website && <a className="btn btn-secondary btn-sm" href={/^https?:/.test(shop.website) ? shop.website : 'https://' + shop.website} target="_blank" rel="noopener noreferrer">🌐 Website</a>}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, brand }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: 'calc(18px + var(--sat)) 14px calc(20px + var(--sab))' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}
        {!brand?.hide_powered && <div style={{ textAlign: 'center', fontSize: '.72rem', color: 'var(--text-muted)', padding: '18px 0 6px' }}>Powered by Stellar Forge</div>}
      </div>
    </div>
  )
}
