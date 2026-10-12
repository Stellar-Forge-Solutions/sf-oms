import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { BASIC_PLAN, PRO_PLAN, planState, upgradeUrl, fmtDate } from '../lib/plans'

// Shows the current plan (trial / Basic / ended) with an Upgrade button that opens WhatsApp.
// compact = smaller version for the Home page.
export default function PlanCard({ compact = false }) {
  const { shop, ent } = useShop()
  const { user } = useAuth()
  if (!shop || shop.status !== 'approved') return null
  const st = planState(ent)
  const renew = st.kind === 'paid'

  const badge = st.kind === 'paid'
    ? { text: 'Basic plan active', bg: 'var(--teal-glow)', color: 'var(--teal-dark)' }
    : st.kind === 'trial'
      ? { text: `Free trial · ${st.days} day${st.days === 1 ? '' : 's'} left`, bg: '#fff7e6', color: '#b45309' }
      : { text: 'Trial ended · view only', bg: '#fee2e2', color: '#b91c1c' }

  const btnText = renew ? '🔄 Renew plan on WhatsApp' : '⭐ Upgrade to Basic plan'

  return (
    <div className="card" style={{ marginBottom: 16, textAlign: 'left', ...(compact ? { width: '100%', maxWidth: 340, padding: 16 } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: badge.bg, color: badge.color }}>{badge.text}</span>
        {st.until && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.kind === 'ended' ? 'Ended' : 'Until'} {fmtDate(st.until)}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? '1.3rem' : '1.6rem', fontWeight: 800, color: 'var(--ink)' }}>₹{BASIC_PLAN.monthly}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ month · Basic plan</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: compact ? 8 : 10 }}>
        or ₹{BASIC_PLAN.yearly} / year (save about a third)
      </div>

      {!compact && (
        <ul style={{ paddingLeft: 18, margin: '0 0 12px', fontSize: '0.85rem', lineHeight: 1.7 }}>
          {BASIC_PLAN.features.map(f => <li key={f}>{f}</li>)}
        </ul>
      )}

      <a className={`btn ${renew ? 'btn-secondary' : 'btn-primary'} btn-full`} style={{ textDecoration: 'none' }}
        href={upgradeUrl(shop, user, renew)} target="_blank" rel="noopener noreferrer">
        {btnText}
      </a>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        Opens WhatsApp with a ready message. We activate your plan after payment.
      </div>

      {/* Pro plan */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--ink)', color: 'var(--white)', borderRadius: 99, padding: '2px 9px' }}>PRO</span>
          <span style={{ fontSize: compact ? '1.05rem' : '1.2rem', fontWeight: 800, color: 'var(--ink)' }}>₹{PRO_PLAN.monthly}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>/ month · or ₹{PRO_PLAN.yearly} / year</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
          For growing shops: your own web address, full branding and team logins.
        </div>
        {!compact && (
          <ul style={{ paddingLeft: 18, margin: '0 0 10px', fontSize: '0.82rem', lineHeight: 1.7 }}>
            {PRO_PLAN.features.map(f => <li key={f}>{f}</li>)}
          </ul>
        )}
        <a className="btn btn-dark btn-full btn-sm" style={{ textDecoration: 'none' }}
          href={upgradeUrl(shop, user, false, 'pro')} target="_blank" rel="noopener noreferrer">
          💬 Ask about Pro plan
        </a>
      </div>
    </div>
  )
}
