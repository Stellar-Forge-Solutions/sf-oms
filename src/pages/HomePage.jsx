import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import PlanCard from '../components/PlanCard'
import { StageBadge, PayBadge } from '../components/Badges'
import { inr, orderNo, fmtDate, rangeFor, stageColor, r2 } from '../lib/orderUtils'

export default function HomePage() {
  const { shop, settings } = useShop(), nav = useNavigate()
  const [period, setPeriod] = useState('month')
  const [rows, setRows] = useState([]), [recent, setRecent] = useState([]), [loading, setLoading] = useState(true)
  const stages = settings.stages

  useEffect(() => {
    setLoading(true)
    const r = rangeFor(period)
    supabase.rpc('orders_summary', { p_from: r?.from?.toISOString() ?? null, p_to: r?.to?.toISOString() ?? null })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [period])
  useEffect(() => { supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(8).then(({ data }) => setRecent(data || [])) }, [])

  const by = Object.fromEntries(stages.map(s => [s.key, { n: 0, v: 0 }]))
  for (const o of rows) by[o.stage_key] = { n: Number(o.n), v: Number(o.total) }
  const live = rows.filter(o => o.stage_key !== 'returned')
  const revenue = r2(live.reduce((t, o) => t + Number(o.total), 0))
  const collected = r2(live.reduce((t, o) => t + Number(o.paid || 0), 0))
  const returnedCount = by.returned?.n || 0

  return (
    <div className="page-wide">
      <div className="page-head">
        <div><h1 className="page-title">Hello, {(shop?.owner_name || shop?.name || '').split(' ')[0]} 👋</h1><p className="page-subtitle">Here is how your orders are doing.</p></div>
        <Link to="/orders/new" className="btn btn-primary btn-lg">+ New order</Link>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        {[['today', 'Today'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => <button key={k} className={`chip ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value teal" style={{ fontSize: '1.15rem' }}>{loading ? '…' : inr(revenue)}</div></div>
        <div className="stat-card"><div className="stat-label">Collected</div><div className="stat-value" style={{ fontSize: '1.15rem' }}>{loading ? '…' : inr(collected)}</div></div>
        <div className="stat-card"><div className="stat-label">To collect</div><div className="stat-value" style={{ fontSize: '1.15rem', color: 'var(--warning)' }}>{loading ? '…' : inr(Math.max(0, revenue - collected))}</div></div>
      </div>

      <div className="section-title" style={{ marginBottom: 10 }}>Orders by status</div>
      <div className="stage-grid">
        {stages.map(s => {
          const b = by[s.key] || { n: 0, v: 0 }, alert = s.key === 'returned' && b.n > 0
          return (
            <button key={s.key} className={`stage-card ${alert ? 'returned-alert' : ''}`} style={{ '--c': stageColor(s.key) }} onClick={() => nav(`/orders?stage=${s.key}&range=${period}`)}>
              <div className="n" style={alert ? { color: 'var(--danger)' } : {}}>{loading ? '–' : b.n}</div>
              <div className="l">{s.label}</div>
              <div className="v">{s.key === 'returned' ? (b.n ? `${inr(b.v)} returned` : 'No returned orders') : inr(b.v)}</div>
            </button>)
        })}
      </div>
      <p className="text-muted" style={{ marginBottom: 20, fontSize: '.78rem' }}>
        {returnedCount > 0 ? `⚠️ ${returnedCount} returned order${returnedCount > 1 ? 's' : ''} in this period. Returned orders are not counted in revenue.` : 'Returned orders are not counted in revenue.'}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="section-title">Recent orders</div><Link to="/orders" className="btn btn-ghost btn-sm">View all</Link></div>
        {!recent.length && !loading && <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-icon">📦</div><div className="empty-state-title">No orders yet</div><div className="empty-state-text">Create your first order to see it here.</div></div>}
        {recent.map(o => (
          <Link key={o.id} to={`/orders/${o.id}`} className="item-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ minWidth: 0 }}><b>{o.customer_name}</b><div className="text-muted mono" style={{ fontSize: '.72rem' }}>{orderNo(o, settings)} · {fmtDate(o.created_at)}</div>
              <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}><StageBadge stages={stages} k={o.stage_key} /><PayBadge status={o.payment_status} /></div></div>
            <b style={{ flexShrink: 0 }}>{inr(o.total)}</b>
          </Link>))}
      </div>
      <PlanCard compact />
    </div>
  )
}
