// Self-signup: creates the auth user + a pending shop (no email code), then alerts both admins via Gmail.
import { admin, esc, json, readJson, methodNotAllowed } from '../_shared/common.js'
import { sendMail } from '../_shared/gmail.js'

const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com'])
const ten = (v) => String(v || '').replace(/\D/g, '').slice(-10)

function normalizeEmail(e) {
  const [l, d] = e.trim().toLowerCase().split('@')
  return ['gmail.com', 'googlemail.com'].includes(d) ? l.split('+')[0].replace(/\./g, '') + '@gmail.com' : l.split('+')[0] + '@' + d
}

// Review due = 1 working hour later (working hours 9:00-21:00 IST).
function reviewDue(now = new Date()) {
  const IST = 330 * 60e3, t = new Date(now.getTime() + IST)
  const open = 9 * 60, close = 21 * 60
  let cur = t.getUTCHours() * 60 + t.getUTCMinutes(), day = 0, need = 60
  if (cur < open) cur = open
  if (cur >= close) { cur = open; day = 1 }
  if (need > close - cur) { need -= close - cur; day += 1; cur = open + need } else cur += need
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + day, 0, cur) - IST)
}
const hhmm = (d) => d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

export async function onRequestPost({ request, env }) {
  const b = await readJson(request)
  if (b.company_site) return json({ ok: true }) // honeypot: bots fill hidden fields
  const email = String(b.email || '').trim().toLowerCase()
  const name = String(b.name || '').trim().slice(0, 80), owner = String(b.owner_name || '').trim().slice(0, 80)
  const mobile = ten(b.mobile), whatsapp = ten(b.whatsapp || b.mobile), password = String(b.password || '')
  const city = String(b.city || '').trim().slice(0, 60) || null, btype = String(b.business_type || '').trim().slice(0, 60) || null
  const ref = /^https?:\/\/\S+$/i.test(String(b.ref_link || '').trim()) ? String(b.ref_link).trim().slice(0, 300) : null
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
  if (!name || !owner) return json({ error: 'Shop name and owner name are required' }, 400)
  if (mobile.length !== 10 || whatsapp.length !== 10) return json({ error: 'Enter 10-digit mobile and WhatsApp numbers' }, 400)

  const sb = admin(env)
  const norm = normalizeEmail(email)
  const [{ data: b1 }, { data: b2 }, { data: dup }] = await Promise.all([
    sb.from('blocklist').select('value').eq('kind', 'email').eq('value', norm).maybeSingle(),
    sb.from('blocklist').select('value').eq('kind', 'mobile').eq('value', mobile).maybeSingle(),
    sb.from('shops').select('id').eq('email_normalized', norm).maybeSingle(),
  ])
  if (b1 || b2) return json({ error: 'This account cannot be created. Please contact Stellar Forge.' }, 403)
  if (dup) return json({ error: 'This email is already registered with Stellar Forge. Please sign in: if your shop is already approved, you can start your free Orders trial there.' }, 409)

  const { data: u, error: ue } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
  if (ue) { const dupe = /regist|exist/i.test(ue.message); return json({ error: dupe ? 'This email is already registered with Stellar Forge. Please sign in: if your shop is already approved, you can start your free Orders trial there.' : 'Could not create account' }, dupe ? 409 : 500) }

  const due = reviewDue()
  const { data: shop, error: se } = await sb.from('shops').insert({
    owner_id: u.user.id, email, email_normalized: norm, name, owner_name: owner, mobile, whatsapp,
    city, business_type: btype, ref_link: ref, review_due_at: due.toISOString(), signup_product: 'orders',
  }).select().single()
  if (se) { await sb.auth.admin.deleteUser(u.user.id); return json({ error: se.code === '23505' ? 'This email is already registered.' : 'Could not create shop' }, se.code === '23505' ? 409 : 500) }

  const flags = []
  if (DISPOSABLE.has(email.split('@')[1])) flags.push('disposable email domain')
  const { count } = await sb.from('shops').select('id', { count: 'exact', head: true }).or(`mobile.eq.${mobile},whatsapp.eq.${whatsapp}`).neq('id', shop.id)
  if (count) flags.push(`mobile/WhatsApp already used by ${count} other shop(s)`)
  const wa = 'https://wa.me/91' + whatsapp
  try {
    await sendMail(env, {
      to: String(env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean),
      subject: `New ORDERS signup: ${name}, review by ${hhmm(due)} IST`,
      html: `<h3>New shop signup (Orders)</h3><p><b>${esc(name)}</b> · ${esc(owner)}<br>Mobile: ${mobile}<br>WhatsApp: <a href="${wa}">${whatsapp} (tap to chat)</a><br>Email: ${esc(email)}<br>City: ${esc(city || '-')} · Business: ${esc(btype || '-')}${ref ? `<br>Link: ${esc(ref)}` : ''}</p>
        <p>Signed up: ${hhmm(new Date())} IST · <b>Review by: ${hhmm(due)} IST</b></p><p>Flags: ${flags.length ? esc(flags.join('; ')) : 'none'}</p>
        <p><a href="${env.ADMIN_DASH_URL}" style="background:#00c9a7;color:#0f1923;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Review in dashboard</a></p>`,
    })
  } catch (e) { console.error('alert email failed', e.message) } // signup still succeeds; the dashboard queue shows it
  return json({ ok: true })
}
export const onRequest = methodNotAllowed
