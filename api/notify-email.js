// Sends the customer a professional status e-mail (shop name as sender, shop e-mail as reply-to).
// Everything is read from the database here, so the browser cannot change the content.
import { admin, esc } from './_lib/common.js'
import { sendMail } from './_lib/gmail.js'
import { mergeSettings, stageLabel } from '../src/lib/orderUtils.js'

const inr = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const LINE = {
  received: 'Thank you for your order. We have received it and will begin work on it shortly.',
  processing: 'Your order is now being processed by our team.',
  ready: 'Good news: your order is ready and will be dispatched soon.',
  delivered: 'Your order has been delivered. We hope everything is to your satisfaction.',
  returned: 'Your order has been marked as returned. If you have any questions, please get in touch with us.',
}
const PAY = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid', refunded: 'Returned back' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const sb = admin()
  const jwt = (req.headers.authorization || '').replace(/^Bearer /, '')
  const { data: { user } } = await sb.auth.getUser(jwt)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  const { data: shop } = await sb.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
  const { data: o } = await sb.from('orders').select('*').eq('id', String(req.body?.id || '')).maybeSingle()
  if (!shop || !o || o.shop_id !== shop.id) return res.status(404).json({ error: 'Order not found' })
  if (!o.customer_email) return res.status(400).json({ error: 'This customer has no email address' })
  const { data: ok } = await sb.rpc('shop_can_write', { p_shop: shop.id, p_product: 'orders' })
  if (!ok) return res.status(403).json({ error: 'Your plan is not active' })

  const [{ data: st }, { data: items }] = await Promise.all([
    sb.from('order_settings').select('*').eq('shop_id', shop.id).maybeSingle(),
    sb.from('order_items').select('*').eq('order_id', o.id).order('created_at'),
  ])
  const s = mergeSettings(st)
  const base = (s.custom_url || process.env.APP_URL || '').replace(/\/+$/, '')
  if (!base) return res.status(500).json({ error: 'APP_URL is not configured on the server' })
  const label = stageLabel(s.stages, o.stage_key), no = s.order_prefix + String(o.order_no).padStart(5, '0')
  const track = `${base}/track/${o.token}`, bill = o.bill_path ? `${base}/api/bill?t=${o.token}` : null
  const color = /^#[0-9a-f]{6}$/i.test(s.brand_color || '') ? s.brand_color : '#00a88c'
  const logo = shop.logo_path ? `${process.env.SUPABASE_URL}/storage/v1/object/public/logos/${shop.logo_path}` : null
  const btn = (href, text, solid) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;${solid ? `background:${color};color:#ffffff;` : `border:1.5px solid ${color};color:${color};`}">${text}</a>`

  const rows = (items || []).map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #e8edf2;font-size:14px;color:#0f1923">${esc(i.name)}<br><span style="font-size:12px;color:#6b7c93">${Number(i.quantity)}${i.unit ? ' ' + esc(i.unit) : ''} × ${inr(i.unit_price)}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #e8edf2;font-size:14px;color:#0f1923;white-space:nowrap">${inr(Number(i.line_total) + Number(i.tax_amt))}</td></tr>`).join('')
  const tot = (l, v, b) => `<tr><td style="padding:4px 0;font-size:${b ? 16 : 13}px;${b ? 'font-weight:700;' : 'color:#6b7c93;'}">${l}</td><td align="right" style="padding:4px 0;font-size:${b ? 16 : 13}px;${b ? 'font-weight:700;' : ''}">${v}</td></tr>`
  const contact = [shop.mobile && `Call: ${esc(shop.mobile)}`, shop.website && esc(shop.website)].filter(Boolean).join(' &nbsp;·&nbsp; ')

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0f1923;padding:20px 28px">${logo ? `<img src="${esc(logo)}" alt="" height="36" style="vertical-align:middle;margin-right:10px">` : ''}<span style="color:#ffffff;font-size:18px;font-weight:700;vertical-align:middle">${esc(shop.name)}</span></td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 6px;font-size:15px;color:#0f1923">Dear ${esc(o.customer_name)},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#33434f">${esc(LINE[o.stage_key] || `Your order status has been updated to "${label}".`)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;border-radius:10px;margin-bottom:20px"><tr>
        <td style="padding:14px 16px"><div style="font-size:11px;color:#6b7c93;text-transform:uppercase;letter-spacing:.06em">Order</div><div style="font-size:16px;font-weight:700;color:#0f1923">${esc(no)}</div></td>
        <td style="padding:14px 16px" align="right"><div style="font-size:11px;color:#6b7c93;text-transform:uppercase;letter-spacing:.06em">Current status</div><div style="font-size:16px;font-weight:700;color:${color}">${esc(label)}</div></td></tr></table>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px">
        ${tot('Subtotal', inr(o.subtotal))}${Number(o.tax_total) > 0 ? tot('Tax', inr(o.tax_total)) : ''}${Number(o.freight) > 0 ? tot('Freight / delivery', inr(o.freight)) : ''}
        ${tot('Total', inr(o.total), true)}${tot('Payment', PAY[o.payment_status] + (o.payment_status === 'partial' ? ` (${inr(o.amount_paid)} received)` : ''))}</table>
      <div style="margin-top:22px">${btn(track, 'Track your order', true)}${bill ? btn(bill, 'Download bill', false) : ''}</div>
      <p style="margin:18px 0 0;font-size:13px;color:#6b7c93;line-height:1.5">${esc(shop.thank_you || 'Thank you for your business.')}</p>
    </td></tr>
    <tr><td style="background:#f7f8fa;padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#6b7c93;line-height:1.6">
      <b style="color:#0f1923">${esc(shop.name)}</b>${shop.address ? '<br>' + esc(shop.address) : ''}${contact ? '<br>' + contact : ''}${shop.gst_no ? '<br>GSTIN: ' + esc(shop.gst_no) : ''}
      ${s.hide_powered ? '' : '<br><span style="color:#9aa8b8">Powered by Stellar Forge</span>'}</td></tr>
  </table></td></tr></table></body></html>`

  try {
    await sendMail({ to: o.customer_email, subject: `Order ${no}: ${label} · ${shop.name}`, html, fromName: shop.name, replyTo: shop.email })
  } catch (e) { console.error('notify email failed', e.message); return res.status(502).json({ error: 'Email could not be sent. Please try again.' }) }
  res.json({ ok: true })
}
