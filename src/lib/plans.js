// Plan details and the "Upgrade" WhatsApp link. Change prices / number here only.
// NOTE: prices below are placeholders copied from sf-billing: set your real Orders pricing.
export const UPGRADE_WHATSAPP = '919270243271'

export const BASIC_PLAN = {
  name: 'Basic', monthly: 99, yearly: 799,
  features: [
    'Unlimited orders and products',
    'Your own order stages (up to 7)',
    'Tracking link, bill link, email and WhatsApp updates',
    'Thermal and normal printer support',
    'Excel import, CSV / Excel / PDF export',
  ],
}
export const PRO_PLAN = {
  name: 'Pro', monthly: 199, yearly: 1599,
  features: [
    'Everything in Basic',
    'Custom URL for your tracking links',
    'Complete branding: colour, logo, no "Powered by"',
    'Multiple logins for your team (contact us)',
    'Dedicated infrastructure (contact us)',
  ],
}

export const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

// paid | trial | ended
export function planState(ent) {
  const now = Date.now()
  if (ent?.paid_until && new Date(ent.paid_until) > now) return { kind: 'paid', until: ent.paid_until, days: Math.ceil((new Date(ent.paid_until) - now) / 864e5) }
  if (ent?.trial_ends_at && new Date(ent.trial_ends_at) > now) return { kind: 'trial', until: ent.trial_ends_at, days: Math.ceil((new Date(ent.trial_ends_at) - now) / 864e5) }
  return { kind: 'ended', until: ent?.paid_until || ent?.trial_ends_at || null, days: 0 }
}

export function upgradeUrl(shop, user, renew = false, plan = 'basic') {
  const lines = [
    plan === 'pro' ? `Hello Stellar Forge, I want to know more about / upgrade to the Orders Pro plan (Rs. ${PRO_PLAN.monthly}/month).`
    : renew ? 'Hello Stellar Forge, I want to renew my Orders Basic plan.'
    : `Hello Stellar Forge, I want to upgrade to the Orders Basic plan (Rs. ${BASIC_PLAN.monthly}/month).`,
    '', `Shop: ${shop?.name || '-'}`, `Mobile: ${shop?.mobile || '-'}`, `Email: ${user?.email || '-'}`, '',
    'Please share the payment details and activate my account.',
  ]
  return `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`
}
export const contactUrl = (topic, shop, user) =>
  `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(`Hello Stellar Forge, I am interested in: ${topic}.\nShop: ${shop?.name || '-'}\nEmail: ${user?.email || '-'}`)}`
