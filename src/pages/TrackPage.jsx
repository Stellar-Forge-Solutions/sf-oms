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

  return (
    <Shell brand={brand}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        {shop.logo && <img src={shop.logo} alt="" style={{ height: 52, marginBottom: 6 }} />}
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{shop.name}</div>
        {shop.tagline && <div className="text-muted">{shop.tagline}</div>}
      </div>

      <div className="card" style={{ marginBottom: 14, borderTop: `4px solid ${color}` }}>
        <div className="text-muted">Hello {o.customer_name}, here is your order</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, margin: '2px 0 16px' }}>{o.no}</div>
        <div className="timeline" style={{ borderLeftColor: 'transparent', position: 'relative' }}>
          {stages.map((s, i) => {
            const done = i <= idx, now = i === idx, bad = s.key === 'returned' && now
            const c = bad ? '#ef4444' : color
            return (
              <div key={s.key} style={{ position: 'relative', paddingBottom: i === stages.length - 1 ? 0 : 20, paddingLeft: 6 }}>
                {i < stages.length - 1 && <span style={{ position: 'absolute', left: -9, top: 18, bottom: -2, width: 3, background: i < idx ? color : 'var(--border)', borderRadius: 3 }} />}
                <span style={{ position: 'absolute', left: -15, top: 2, width: 15, height: 15, borderRadius: '50%', background: done ? c : 'var(--white)', border: `3px solid ${done ? c : 'var(--border)'}`, boxShadow: now ? `0 0 0 5px ${c}30` : 'none' }} />
                <div style={{ fontWeight: now ? 700 : 500, color: done ? 'var(--ink)' : 'var(--text-muted)', fontSize: now ? '1.02rem' : '.92rem' }}>{s.label}{now && <span style={{ marginLeft: 8, fontSize: '.68rem', background: c, color: '#fff', borderRadius: 99, padding: '2px 8px', verticalAlign: 'middle' }}>{bad ? 'Returned' : 'Current'}</span>}</div>
                {done && <div className="text-muted" style={{ fontSize: '.76rem' }}>{when(s.key)}</div>}
              </div>)
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>Items</div>
        {items.map((it, i) => (
          <div className="item-row" key={i}>
            <div style={{ minWidth: 0 }}><b>{it.name}</b><div className="text-muted" style={{ fontSize: '.78rem' }}>{Number(it.quantity)}{fields.unit && it.unit ? ' ' + it.unit : ''} × {inr(it.unit_price)}{fields.category && it.category ? ` · ${it.category}` : ''}</div>
              {fields.description && it.description && <div className="text-muted" style={{ fontSize: '.78rem' }}>{it.description}</div>}</div>
            <b style={{ flexShrink: 0 }}>{inr(Number(it.line_total) + Number(it.tax_amt))}</b>
          </div>))}
        <div className="divider" />
        <div className="tot-row"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
        {Number(o.cgst_amt) > 0 && <div className="tot-row"><span>CGST</span><span>{inr(o.cgst_amt)}</span></div>}
        {Number(o.sgst_amt) > 0 && <div className="tot-row"><span>SGST</span><span>{inr(o.sgst_amt)}</span></div>}
        {Number(o.igst_amt) > 0 && <div className="tot-row"><span>IGST</span><span>{inr(o.igst_amt)}</span></div>}
        {Number(o.freight) > 0 && <div className="tot-row"><span>Freight / delivery</span><span>{inr(o.freight)}</span></div>}
        <div className="tot-row grand"><span>Total</span><span>{inr(o.total)}</span></div>
        <div className="tot-row" style={{ alignItems: 'center' }}><span>Payment</span><span className="badge" style={{ background: p.bg, color: p.fg }}>{p.label}{o.payment_status === 'partial' ? ` · ${inr(o.amount_paid)} received` : ''}</span></div>
      </div>

      {o.has_bill
        ? <a className="btn btn-lg btn-full" style={{ background: color, color: '#fff', marginBottom: 12, textDecoration: 'none' }} href={`/api/bill?t=${token}`}>⬇️ Download bill</a>
        : <div className="hint-box">Your bill will appear here once the shop adds it.</div>}

      <div className="card" style={{ textAlign: 'center' }}>
        <div className="text-muted" style={{ marginBottom: 8 }}>{shop.thank_you || 'Thank you for your order!'}</div>
        {shop.address && <div style={{ fontSize: '.85rem' }}>{shop.address}</div>}
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
