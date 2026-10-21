import { PLANS, UPGRADE_WHATSAPP } from './plans.config'
import { IST } from './orderUtils'

// Returns normalized plan definition for a shop
export function getPlan(shop, ent) {
  // Check shop.plan first, fallback to ent.plan, default to 'free'
  const planKey = (shop?.plan || ent?.plan || 'free').toLowerCase()
  return PLANS[planKey] || PLANS.free
}

// Single central feature gate helper
export function can(shop, featureName, ent = null) {
  const plan = getPlan(shop, ent)
  return !!plan[featureName]
}

// Returns start of current month and start of next month in IST
export function getMonthBounds(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit' }).format(d).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const from = new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01T00:00:00+05:30`)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const to = new Date(`${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`)
  return { from, to, monthLabel: from.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: IST }) }
}

// Computes overage usage & costs for an order count
export function calculateOverage(ordersCount, plan, overageLimit = 100) {
  const included = plan.includedOrders
  const used = Number(ordersCount) || 0
  const isUnlimited = included === Infinity

  if (isUnlimited) {
    return {
      used,
      included,
      pctUsed: 0,
      overageOrders: 0,
      overageAmount: 0,
      overageLimit: Number(overageLimit) || 0,
      isNearLimit: false,
      isAtLimit: false,
      isOverageBlocked: false,
      remainingIncluded: Infinity,
    }
  }

  const overageOrders = Math.max(0, used - included)
  const overageAmount = Math.round(overageOrders * (plan.overageRate || 0.30) * 100) / 100
  const pctUsed = Math.min(100, Math.round((used / included) * 100))
  const remainingIncluded = Math.max(0, included - used)
  const limit = Number(overageLimit ?? 100)

  // Blocked if overage limit is set and overage cost has reached or exceeded limit
  // Note: if limit is 0, any overage is immediately blocked
  const isOverageBlocked = overageOrders > 0 && (limit === 0 || overageAmount >= limit)

  return {
    used,
    included,
    pctUsed,
    overageOrders,
    overageAmount,
    overageLimit: limit,
    isNearLimit: used >= included * 0.8 && used < included,
    isAtLimit: used >= included,
    isOverageBlocked,
    remainingIncluded,
  }
}

// URL for upgrading via WhatsApp
export function upgradeUrl(shop, user, targetPlan = 'basic', billingCycle = 'monthly') {
  const target = PLANS[targetPlan] || PLANS.basic
  const price = billingCycle === 'yearly' ? `₹${target.priceYearly}/year` : `₹${target.priceMonthly}/month`
  const lines = [
    targetPlan === 'pro'
      ? `Hello Stellar Forge, I am interested in upgrading my Orders account to the PRO plan.`
      : `Hello Stellar Forge, I want to upgrade my Orders account to the ${target.name} plan (${price}).`,
    '',
    `Shop Name: ${shop?.name || '-'}`,
    `Mobile: ${shop?.mobile || '-'}`,
    `Email: ${user?.email || shop?.email || '-'}`,
    `Current Plan: ${shop?.plan?.toUpperCase() || 'FREE'}`,
    '',
    'Please share the payment / activation details.',
  ]
  return `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`
}

export function contactUrl(topic, shop, user) {
  const lines = [
    `Hello Stellar Forge, I have a question regarding: ${topic}.`,
    '',
    `Shop: ${shop?.name || '-'}`,
    `Mobile: ${shop?.mobile || '-'}`,
    `Email: ${user?.email || shop?.email || '-'}`,
  ]
  return `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`
}
