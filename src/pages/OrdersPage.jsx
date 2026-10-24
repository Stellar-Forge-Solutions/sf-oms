import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useToast } from '../components/Toast'
import { StageBadge, PayBadge } from '../components/Badges'
import AdBanner from '../components/AdBanner'
import { exportOrders } from '../lib/exportUtils'
import { orderNo, inr, fmtDate, rangeFor, fyOptions, fyLabel, yearOptions, currentFY, PAY, r2, billUrl } from '../lib/orderUtils'

const MODES = [['all', 'All time'], ['today', 'Today'], ['month', 'This month'], ['lastmonth', 'Last month'], ['pickmonth', 'Pick a month'], ['year', 'Year'], ['fy', 'Financial year'], ['custom', 'Custom range']]

export default function OrdersPage() {
  const { settings, isStaff } = useShop(), toast = useToast(), nav = useNavigate()
  const [sp] = useSearchParams()
  const [mode, setMode] = useState(sp.get('range') || 'all')
  const [v, setV] = useState({ month: new Date().toISOString().slice(0, 7), year: String(new Date().getFullYear()), fy: String(currentFY()), from: '', to: '' })
  const [stage, setStage] = useState(sp.get('stage') || 'all')
  const [pay, setPay] = useState('all'), [q, setQ] = useState('')
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [capped, setCapped] = useState(false)
  const stages = settings.stages

  useEffect(() => {
    setLoading(true)
    const r = rangeFor(mode, v)
    let alive = true
    ;(async () => {
      const all = []
      for (let page = 0; page < 3; page++) {            // 3 pages x 1000 = latest 3,000 orders
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
        if (r?.from) query = query.gte('created_at', r.from.toISOString())
        if (r?.to) query = query.lt('created_at', r.to.toISOString())
        if (stage !== 'all') query = query.eq('stage_key', stage)
        if (pay !== 'all') query = query.eq('payment_status', pay)
        const { data, error } = await query
        if (error) { toast(error.message, 'error'); break }
        all.push(...data); if (data.length < 1000) break
      }
      if (!alive) return
      setRows(all); setCapped(all.length >= 3000); setLoading(false)
    })()
    return () => { alive = false }
  }, [mode, v.month, v.year, v.fy, v.from, v.to, stage, pay])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return !s ? rows : rows.filter(o => o.customer_name.toLowerCase().includes(s) || orderNo(o, settings).toLowerCase().includes(s) || (o.customer_whatsapp || '').includes(s))
  }, [rows, q])
  const revenue = r2(shown.filter(o => o.stage_key !== 'returned').reduce((t, o) => t + Number(o.total), 0))

  const label = () => ({ all: 'all-time', today: 'today', month: 'this-month', lastmonth: 'last-month', pickmonth: v.month, year: v.year, fy: fyLabel(+v.fy).replace(/\s/g, ''), custom: `${v.from || 'start'}_to_${v.to || 'now'}` }[mode])
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  return (
    <div className="page-wide">
      <div className="page-head">
        <div><h1 className="page-title">Orders</h1><p className="page-subtitle">{loading ? 'Loading…' : isStaff ? `${shown.length} order${shown.length === 1 ? '' : 's'}` : `${shown.length} order${shown.length === 1 ? '' : 's'} · revenue ${inr(revenue)} (returned orders excluded)`}</p></div>
        <Link to="/orders/new" className="btn btn-primary">+ New order</Link>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Period</label>
            <select className="form-input" value={mode} onChange={e => setMode(e.target.value)}>{MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="form-group" style={{ margin: 0 }}>
            {mode === 'pickmonth' && <><label className="form-label">Month</label><input className="form-input" type="month" value={v.month} onChange={set('month')} /></>}
            {mode === 'year' && <><label className="form-label">Year</label><select className="form-input" value={v.year} onChange={set('year')}>{yearOptions().map(y => <option key={y}>{y}</option>)}</select></>}
            {mode === 'fy' && <><label className="form-label">Apr – Mar</label><select className="form-input" value={v.fy} onChange={set('fy')}>{fyOptions().map(y => <option key={y} value={y}>{fyLabel(y)}</option>)}</select></>}
            {mode === 'custom' && <div className="grid2"><div><label className="form-label">From</label><input className="form-input" type="date" value={v.from} onChange={set('from')} /></div><div><label className="form-label">To</label><input className="form-input" type="date" value={v.to} onChange={set('to')} /></div></div>}
            {!['pickmonth', 'year', 'fy', 'custom'].includes(mode) && <><label className="form-label">Payment</label><select className="form-input" value={pay} onChange={e => setPay(e.target.value)}><option value="all">All payments</option>{Object.entries(PAY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></>}
          </div>
        </div>
        {['pickmonth', 'year', 'fy', 'custom'].includes(mode) && <div className="form-group"><label className="form-label">Payment</label><select className="form-input" value={pay} onChange={e => setPay(e.target.value)}><option value="all">All payments</option>{Object.entries(PAY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>}
        <input className="form-input" placeholder="Search customer, order no, phone…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        <div className="chips">
          <button className={`chip ${stage === 'all' ? 'on' : ''}`} onClick={() => setStage('all')}>All status</button>
          {stages.map(s => <button key={s.key} className={`chip ${stage === s.key ? 'on' : ''}`} onClick={() => setStage(s.key)}>{s.label}</button>)}
        </div>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ alignSelf: 'center' }}>Export:</span>
        {[['csv', 'CSV'], ['xlsx', 'Excel'], ['pdf', 'PDF']].map(([k, l]) => <button key={k} className="btn btn-secondary btn-sm" disabled={!shown.length} onClick={() => exportOrders(k, shown, settings, label())}>⬇️ {l}</button>)}
      </div>
      {capped && <div className="hint-box">Showing the latest 3,000 orders. Narrow the period to see older ones.</div>}

      {!loading && !shown.length && <div className="card empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">No orders found</div><div className="empty-state-text">Try another period or status, or create a new order.</div></div>}

      {/* Phones: cards */}
      <div className="order-cards">
        {shown.map(o => (
          <Link key={o.id} to={`/orders/${o.id}`} className={`order-card ${o.stage_key === 'returned' ? 'is-returned' : ''}`}>
            <div className="row">
              <b>{o.customer_name}</b>
              <div style={{ textAlign: 'right' }}>
                <b>{inr(o.total)}</b>
                {(o.bill_path || o.bill_source === 'generated') && (
                  <span
                    className="badge"
                    style={{ marginLeft: 6, background: 'var(--teal-glow)', color: 'var(--teal-dark)', fontSize: '.72rem', cursor: 'pointer' }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(billUrl(o, settings), '_blank') }}
                  >
                    🧾 Bill
                  </span>
                )}
              </div>
            </div>
            <div className="row mt-1">
              <span className="text-muted mono" style={{ fontSize: '.75rem' }}>{orderNo(o, settings)} · {fmtDate(o.created_at)}</span>
              {o.delivery_date && <span style={{ fontSize: '.75rem', color: 'var(--brand)', fontWeight: 600 }}>📅 Due {fmtDate(o.delivery_date)}</span>}
            </div>
            <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}><StageBadge stages={stages} k={o.stage_key} /><PayBadge status={o.payment_status} /></div>
          </Link>))}
      </div>

      {/* Tablet / desktop: table */}
      {!!shown.length && <div className="card order-table" style={{ padding: 0 }}><div className="table-wrap"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th>Payment</th><th style={{ textAlign: 'right' }}>Total</th><th></th></tr></thead>
        <tbody>{shown.map(o => (
          <tr key={o.id} className={`row-link ${o.stage_key === 'returned' ? 'is-returned' : ''}`} onClick={() => nav(`/orders/${o.id}`)}>
            <td className="mono">{orderNo(o, settings)}</td>
            <td>
              <div>{fmtDate(o.created_at)}</div>
              {o.delivery_date && <div style={{ fontSize: '.72rem', color: 'var(--brand)', fontWeight: 600 }}>Due {fmtDate(o.delivery_date)}</div>}
            </td>
            <td><b>{o.customer_name}</b><div className="text-muted" style={{ fontSize: '.75rem' }}>{o.customer_whatsapp || o.customer_email || ''}</div></td>
            <td><StageBadge stages={stages} k={o.stage_key} /></td><td><PayBadge status={o.payment_status} /></td>
            <td style={{ textAlign: 'right' }}><b>{inr(o.total)}</b></td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {(o.bill_path || o.bill_source === 'generated') && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px', fontSize: '.75rem', minHeight: 28 }}
                  title="View / Download bill"
                  onClick={(e) => { e.stopPropagation(); window.open(billUrl(o, settings), '_blank') }}
                >
                  🧾 Bill
                </button>
              )}
            </td>
          </tr>))}</tbody></table></div></div>}

      {/* AdSense Unit (Free plan only, below the table/cards, never between rows) */}
      {!loading && shown.length > 0 && (
        <AdBanner slotId="orders_list" pageName="Orders List" />
      )}
    </div>
  )
}

