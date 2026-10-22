import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { PLANS } from '../lib/plans.config'
import { upgradeUrl, getMonthBounds } from '../lib/planHelper'
import { fmtDate, inr, orderNo } from '../lib/orderUtils'
import { StageBadge } from '../components/Badges'

export default function BillingPage() {
  const { shop, plan, monthlyUsage, settings, reload } = useShop()
  const { user } = useAuth()
  const toast = useToast()
  const [cycle, setCycle] = useState(shop?.billing_cycle || 'monthly')
  const [overageCap, setOverageCap] = useState(shop?.monthly_overage_limit !== undefined ? String(shop.monthly_overage_limit) : '100')
  const [savingLimit, setSavingLimit] = useState(false)

  // Monthly orders breakdown list
  const [monthlyOrders, setMonthlyOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [showAllOrders, setShowAllOrders] = useState(false)

  const { from, to, monthLabel } = getMonthBounds()

  useEffect(() => {
    if (!shop?.id) return
    setOrdersLoading(true)
    supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shop.id)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: true }) // First created gets included quota
      .then(({ data, error }) => {
        setOrdersLoading(false)
        if (!error && data) {
          setMonthlyOrders(data)
        }
      })
  }, [shop?.id, from, to])

  const saveOverageLimit = async () => {
    const val = Number(overageCap)
    if (isNaN(val) || val < 0) return toast('Please enter a valid amount (0 or greater)', 'error')
    setSavingLimit(true)
    const { error } = await supabase.from('shops').update({ monthly_overage_limit: val }).eq('id', shop.id)
    setSavingLimit(false)
    if (error) return toast('Failed to update limit: ' + error.message, 'error')
    toast('Monthly overage limit updated')
    reload()
  }

  const isUnlimited = plan.includedOrders === Infinity
  const barColor = monthlyUsage.isAtLimit ? 'var(--danger, #ef4444)' : monthlyUsage.isNearLimit ? 'var(--warning, #f59e0b)' : 'var(--teal, #00c9a7)'

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Usage & Billing</h1>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        Track your monthly order volume, overage costs, and manage your subscription.
      </p>

      {/* Current Plan Overview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <div className="text-muted" style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Current Plan</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)' }}>
              {plan.name} Plan
            </div>
          </div>
          <span className="badge" style={{
            background: plan.key === 'pro' ? 'var(--ink)' : plan.key === 'basic' ? 'var(--teal-glow)' : 'rgba(0,0,0,0.06)',
            color: plan.key === 'pro' ? '#fff' : plan.key === 'basic' ? 'var(--teal-dark)' : 'var(--ink)',
            fontSize: '.8rem',
            padding: '4px 12px',
          }}>
            {plan.key.toUpperCase()}
          </span>
        </div>

        {shop?.plan_renewal_date && (
          <div className="text-muted" style={{ fontSize: '.82rem', marginBottom: 12 }}>
            Renewal date: <b>{fmtDate(shop.plan_renewal_date)}</b> ({shop.billing_cycle || 'monthly'})
          </div>
        )}

        {/* Monthly Order Usage Card */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '.92rem' }}>Order Volume ({monthLabel})</span>
            <span style={{ fontSize: '.84rem', fontWeight: 600 }}>
              {isUnlimited ? `${monthlyUsage.used} orders used (Unlimited)` : `${monthlyUsage.used} of ${monthlyUsage.included} orders used`}
            </span>
          </div>

          {!isUnlimited && (
            <div style={{ width: '100%', height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', margin: '8px 0 12px' }}>
              <div style={{
                width: `${monthlyUsage.pctUsed}%`,
                height: '100%',
                background: barColor,
                transition: 'width 0.4s ease',
              }} />
            </div>
          )}

          {/* Overage Details */}
          {!isUnlimited && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
              <div>
                <div className="text-muted" style={{ fontSize: '.75rem' }}>Included remaining</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: monthlyUsage.remainingIncluded === 0 ? 'var(--danger)' : 'var(--ink)' }}>
                  {monthlyUsage.remainingIncluded} orders
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '.75rem' }}>Overage orders</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: monthlyUsage.overageOrders > 0 ? 'var(--warning)' : 'var(--ink)' }}>
                  {monthlyUsage.overageOrders} orders
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '.75rem' }}>Metered overage (₹0.30/ea)</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: monthlyUsage.overageAmount > 0 ? 'var(--danger)' : 'var(--ink)' }}>
                  {inr(monthlyUsage.overageAmount)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Order Entries Breakdown Table */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>Orders & Overage Breakdown ({monthLabel})</div>
              <div className="text-muted" style={{ fontSize: '.8rem' }}>
                {monthlyOrders.length === 0
                  ? 'No orders created yet this month.'
                  : `Showing all ${monthlyOrders.length} order${monthlyOrders.length === 1 ? '' : 's'} created in ${monthLabel}. First ${plan.includedOrders === Infinity ? 'all' : plan.includedOrders} orders are included.`}
              </div>
            </div>
            {monthlyOrders.length > 5 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAllOrders(!showAllOrders)}
                style={{ fontSize: '.78rem' }}
              >
                {showAllOrders ? 'Collapse list' : `View all (${monthlyOrders.length})`}
              </button>
            )}
          </div>

          {monthlyOrders.length > 0 && (
            <>
              {monthlyOrders.length > 6 && (
                <input
                  className="form-input"
                  placeholder="Filter by customer, order #…"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  style={{ marginBottom: 10, fontSize: '.84rem', padding: '6px 10px' }}
                />
              )}

              <div className="table-wrap" style={{ maxHeight: showAllOrders ? '420px' : '260px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Order</th>
                      <th>Date & Time</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Plan Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 18 }} className="text-muted">Loading orders…</td></tr>
                    ) : (
                      monthlyOrders
                        .filter(o => {
                          if (!filterQuery.trim()) return true
                          const q = filterQuery.toLowerCase()
                          return o.customer_name?.toLowerCase().includes(q) || String(o.order_no).includes(q)
                        })
                        .slice(0, showAllOrders ? undefined : 10)
                        .map((o, idx) => {
                          const orderIndex = idx + 1
                          const isOverage = !isUnlimited && orderIndex > plan.includedOrders
                          return (
                            <tr key={o.id} style={{ background: isOverage ? '#fff1f2' : 'transparent' }}>
                              <td className="mono text-muted" style={{ fontSize: '.75rem' }}>{orderIndex}</td>
                              <td>
                                <Link to={`/orders/${o.id}`} style={{ fontWeight: 600, color: 'var(--brand, #00c9a7)', textDecoration: 'none' }}>
                                  {orderNo(o, settings)}
                                </Link>
                              </td>
                              <td style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                                {fmtDate(o.created_at)}
                              </td>
                              <td>
                                <div style={{ fontWeight: 500, fontSize: '.84rem' }}>{o.customer_name}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '.84rem' }}>
                                {inr(o.total)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {isOverage ? (
                                  <span
                                    className="badge"
                                    style={{ background: '#fee2e2', color: '#991b1b', fontSize: '.72rem', fontWeight: 700 }}
                                    title="Metered overage order"
                                  >
                                    +₹0.30 overage
                                  </span>
                                ) : (
                                  <span
                                    className="badge"
                                    style={{ background: 'var(--teal-glow, #e6fffa)', color: 'var(--teal-dark, #0d9488)', fontSize: '.72rem' }}
                                  >
                                    Included (₹0)
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {!showAllOrders && monthlyOrders.length > 10 && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '.78rem', color: 'var(--teal-dark)' }}
                    onClick={() => setShowAllOrders(true)}
                  >
                    + Show {monthlyOrders.length - 10} more orders
                  </button>
                </div>
              )}

              {/* Total Overage Incurred Summary */}
              {monthlyUsage.overageOrders > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginTop: 10,
                }}>
                  <span style={{ fontSize: '.84rem', color: '#991b1b', fontWeight: 600 }}>
                    Total overage accumulated this month ({monthlyUsage.overageOrders} extra orders):
                  </span>
                  <span style={{ fontSize: '1rem', color: '#991b1b', fontWeight: 800 }}>
                    {inr(monthlyUsage.overageAmount)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Overage Limit Setting */}
        {!isUnlimited && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '.92rem', marginBottom: 4 }}>Monthly overage spending limit</div>
            <div className="text-muted" style={{ fontSize: '.8rem', marginBottom: 10 }}>
              Protect against surprise costs. When reached, creating new orders is blocked until next month or upgraded. (Set 0 to block all extra orders; default ₹100).
            </div>
            <div className="flex gap-2" style={{ maxWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, padding: '0 10px', width: '100%' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={overageCap}
                  onChange={e => setOverageCap(e.target.value)}
                  style={{ border: 'none', outline: 'none', width: '100%', padding: '8px 6px', fontSize: '.9rem' }}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={saveOverageLimit} disabled={savingLimit}>
                {savingLimit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Available Plans & Upgrades */}
      <div className="section-title" style={{ marginTop: 24, marginBottom: 12 }}>Choose a Plan</div>

      {/* Billing Cycle Selector */}
      <div className="seg" style={{ maxWidth: 300, marginBottom: 16 }}>
        <button type="button" className={cycle === 'monthly' ? 'on' : ''} onClick={() => setCycle('monthly')}>Monthly billing</button>
        <button type="button" className={cycle === 'yearly' ? 'on' : ''} onClick={() => setCycle('yearly')}>Yearly (Save 28%)</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* FREE */}
        <div className="card" style={{
          border: plan.key === 'free' ? '2px solid var(--teal)' : '1px solid var(--border)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {plan.key === 'free' && (
            <span style={{ position: 'absolute', top: -11, right: 14, background: 'var(--teal)', color: '#fff', fontSize: '.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              CURRENT PLAN
            </span>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--ink)' }}>Free</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 2px' }}>₹0</div>
            <div className="text-muted" style={{ fontSize: '.75rem', marginBottom: 14 }}>Forever free with ads</div>
            <ul style={{ paddingLeft: 18, fontSize: '.8rem', lineHeight: 1.6, margin: '0 0 16px' }}>
              <li><b>100 orders</b> / month included</li>
              <li>₹0.30 per extra order</li>
              <li>1 owner login</li>
              <li>Standard tracking link</li>
              <li>Sponsored banner ads</li>
            </ul>
          </div>
          <div>
            {plan.key === 'free' ? (
              <div className="text-muted" style={{ textAlign: 'center', fontSize: '.8rem', padding: '8px 0' }}>✓ Active</div>
            ) : (
              <div className="text-muted" style={{ textAlign: 'center', fontSize: '.8rem', padding: '8px 0' }}>Included</div>
            )}
          </div>
        </div>

        {/* BASIC */}
        <div className="card" style={{
          border: plan.key === 'basic' ? '2px solid var(--teal)' : '1px solid var(--border)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {plan.key === 'basic' && (
            <span style={{ position: 'absolute', top: -11, right: 14, background: 'var(--teal)', color: '#fff', fontSize: '.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              CURRENT PLAN
            </span>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--ink)' }}>Basic</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 2px' }}>
              ₹{cycle === 'yearly' ? PLANS.basic.priceYearly : PLANS.basic.priceMonthly}
              <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                /{cycle === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: '.75rem', marginBottom: 14 }}>
              {cycle === 'yearly' ? 'billed annually (save ₹99)' : 'billed monthly'}
            </div>
            <ul style={{ paddingLeft: 18, fontSize: '.8rem', lineHeight: 1.6, margin: '0 0 16px' }}>
              <li><b>300 orders</b> / month included</li>
              <li><b>No ads anywhere</b></li>
              <li>₹0.30 per extra order</li>
              <li>Excel import & exports</li>
              <li>Everything in Free</li>
            </ul>
          </div>
          <div>
            {plan.key === 'basic' ? (
              <a className="btn btn-secondary btn-full btn-sm" href={upgradeUrl(shop, user, 'basic', cycle)} target="_blank" rel="noopener noreferrer">
                🔄 Renew / Extend
              </a>
            ) : (
              <a className="btn btn-primary btn-full btn-sm" href={upgradeUrl(shop, user, 'basic', cycle)} target="_blank" rel="noopener noreferrer">
                ⭐ Upgrade to Basic
              </a>
            )}
          </div>
        </div>

        {/* PRO */}
        <div className="card" style={{
          border: plan.key === 'pro' ? '2px solid var(--ink)' : '1px solid var(--border)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {plan.key === 'pro' && (
            <span style={{ position: 'absolute', top: -11, right: 14, background: 'var(--ink)', color: '#fff', fontSize: '.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              CURRENT PLAN
            </span>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--ink)' }}>Pro</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 2px' }}>
              From ₹199
              <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>/mo</span>
            </div>
            <div className="text-muted" style={{ fontSize: '.75rem', marginBottom: 14 }}>Customized per shop</div>
            <ul style={{ paddingLeft: 18, fontSize: '.8rem', lineHeight: 1.6, margin: '0 0 16px' }}>
              <li><b>Unlimited orders</b></li>
              <li><b>Staff logins</b> (multi-user roles)</li>
              <li><b>Shop branding</b> (logo & colors)</li>
              <li>Custom order stages (up to 8)</li>
              <li>Verified shop badge</li>
              <li>Custom tracking domain</li>
            </ul>
          </div>
          <div>
            <a className="btn btn-dark btn-full btn-sm" href={upgradeUrl(shop, user, 'pro', cycle)} target="_blank" rel="noopener noreferrer">
              💬 Contact for Pro
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
