import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { PLANS } from '../lib/plans.config'
import { upgradeUrl } from '../lib/planHelper'
import { fmtDate, inr } from '../lib/orderUtils'
import { Link } from 'react-router-dom'

// Shows the current plan (Free / Basic / Pro) and usage with upgrade options.
export default function PlanCard({ compact = false }) {
  const { shop, plan, monthlyUsage } = useShop()
  const { user } = useAuth()
  if (!shop || shop.status !== 'approved') return null

  const isFree = plan.key === 'free'
  const isBasic = plan.key === 'basic'
  const isPro = plan.key === 'pro'

  const badge = isPro
    ? { text: 'Pro Plan Active', bg: 'var(--ink)', color: '#fff' }
    : isBasic
      ? { text: 'Basic Plan Active', bg: 'var(--teal-glow)', color: 'var(--teal-dark)' }
      : { text: 'Free Plan Active', bg: 'rgba(0,0,0,0.06)', color: 'var(--ink)' }

  return (
    <div className="card" style={{ marginBottom: 16, textAlign: 'left', ...(compact ? { width: '100%', maxWidth: 360, padding: 16 } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: badge.bg, color: badge.color }}>{badge.text}</span>
        {shop.plan_renewal_date && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Renews {fmtDate(shop.plan_renewal_date)}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? '1.25rem' : '1.5rem', fontWeight: 800, color: 'var(--ink)' }}>
          {isFree ? '₹0' : isBasic ? `₹${PLANS.basic.priceMonthly}` : `₹${PLANS.pro.priceMonthly}+`}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ month · {plan.name}</span>
      </div>

      {/* Usage summary */}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '6px 0 10px' }}>
        {plan.includedOrders === Infinity
          ? `${monthlyUsage.used} orders used this month (Unlimited)`
          : `${monthlyUsage.used} of ${plan.includedOrders} orders used this month`}
      </div>

      {isFree && (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Upgrade to <b>Basic (₹29/month)</b> to remove ads & get 300 orders/month.
          </div>
          <div className="flex gap-2">
            <Link to="/billing" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
              Usage & Plans
            </Link>
            <a className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
              href={upgradeUrl(shop, user, 'basic')} target="_blank" rel="noopener noreferrer">
              ⭐ Upgrade ₹29
            </a>
          </div>
        </>
      )}

      {isBasic && (
        <div className="flex gap-2">
          <Link to="/billing" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
            Usage & Plans
          </Link>
          <a className="btn btn-dark btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
            href={upgradeUrl(shop, user, 'pro')} target="_blank" rel="noopener noreferrer">
            💬 Pro Plan
          </a>
        </div>
      )}

      {isPro && (
        <Link to="/billing" className="btn btn-secondary btn-full btn-sm" style={{ textAlign: 'center', textDecoration: 'none' }}>
          View Usage & Billing
        </Link>
      )}
    </div>
  )
}

