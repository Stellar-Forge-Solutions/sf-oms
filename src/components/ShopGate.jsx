import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { upgradeUrl } from '../lib/plans'

const wrap = { minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
const card = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, maxWidth: 420, color: '#fff', textAlign: 'center' }
const hhmm = (d) => new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
const daysLeft = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5)

function Screen({ title, children }) {
  const { signOut } = useAuth()
  return (
    <div style={wrap}><div style={card}>
      <img src="/sf-mark-light.png" alt="" style={{ width: 56, marginBottom: 12 }} />
      <h2 style={{ margin: '0 0 12px' }}>{title}</h2>
      <div style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{children}</div>
      <button className="btn btn-ghost" style={{ marginTop: 20, color: 'rgba(255,255,255,0.5)' }} onClick={signOut}>Sign out</button>
      <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Powered by Stellar Forge</div>
    </div></div>
  )
}

export default function ShopGate({ children, loading }) {
  const { shop, ent, canWrite, loading: busy, reload } = useShop()
  const { user } = useAuth()
  if (busy) return loading
  if (!shop) return <Screen title="No shop found">This account is not linked to a shop. Please contact Stellar Forge.</Screen>
  if (shop.status === 'pending_review') return (
    <Screen title={`Thanks, ${shop.name}!`}>
      <p>Your account is under review.</p>
      <p>We'll review it within 1 hour (9 am – 9 pm IST){shop.review_due_at && <> — by <b>{hhmm(shop.review_due_at)} IST</b></>} and WhatsApp you on <b>{shop.whatsapp}</b>.</p>
      <p><b>Refresh this page to keep checking your status.</b></p>
      <button className="btn btn-primary" onClick={reload}>Check status</button>
    </Screen>)
  if (shop.status === 'rejected') return <Screen title="Account not approved">We could not approve this account.{shop.review_note ? ` Note: ${shop.review_note}` : ''} Reply to our email if you think this is a mistake.</Screen>
  if (shop.status === 'suspended') return <Screen title="Account on hold">Your account is on hold. Please contact Stellar Forge to continue.</Screen>

  if (!ent) return <Screen title="Orders is not activated yet">Your shop is approved, but the Orders product is not switched on for it. Please contact Stellar Forge and we will start your 15-day free trial.</Screen>

  const end = ent?.paid_until && new Date(ent.paid_until) > Date.now() ? ent.paid_until : ent?.trial_ends_at
  const onTrial = !(ent?.paid_until && new Date(ent.paid_until) > Date.now())
  const bar = !canWrite
    ? 'View only: your trial has ended. You can view orders, but new orders, status changes, printing, sharing and exports are off. Contact Stellar Forge to continue.'
    : onTrial && end && daysLeft(end) <= 5 ? `Free trial: ${Math.max(daysLeft(end), 0)} day(s) left.` : ''
  return <>{bar && (
    <div style={{ background: canWrite ? '#f59e0b' : '#ef4444', color: '#fff', padding: '8px 14px', fontSize: '0.85rem', textAlign: 'center' }}>
      {bar}{' '}
      <a href={upgradeUrl(shop, user)} target="_blank" rel="noopener noreferrer"
        style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>⭐ Upgrade to Basic plan</a>
    </div>)}{children}</>
}
