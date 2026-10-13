// Receipt JSON for the Thermer / Bluetooth Print app. Needs a valid signed token from /api/print-token.
// Layout width follows the shop's paper setting (58 mm = 32 chars, 80 mm = 48 chars).
import { admin, json, hmacHex, safeEqual } from '../_shared/common.js'
import { mergeSettings } from '../../src/lib/orderUtils.js'

const pad = (str, len, right = false) => { const s = String(str).substring(0, len); return right ? s.padStart(len) : s.padEnd(len) }
const text = (content, { bold = 0, align = 0, format = 0 } = {}) => ({ type: 0, content, bold, align, format })
const BLANK = { type: 0, content: ' ', bold: 0, align: 0, format: 0 }
const PAY = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid', refunded: 'Returned back' }

async function validToken(env, id, t) {
  const [exp, sig] = String(t || '').split('.')
  if (!exp || !sig || Date.now() > Number(exp)) return false
  return safeEqual(sig, await hmacHex(env.PRINT_SIGNING_SECRET, `${id}.${exp}`))
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams
  const id = String(q.get('id') || '')
  if (!id || !(await validToken(env, id, q.get('t')))) return json({ error: 'Invalid or expired print link' }, 401)

  const sb = admin(env)
  const { data: o } = await sb.from('orders').select('*').eq('id', id).maybeSingle()
  if (!o) return json({ error: 'Order not found' }, 404)
  const { data: ok } = await sb.rpc('shop_can_write', { p_shop: o.shop_id, p_product: 'orders' })
  if (!ok) return json({ error: 'Orders is not active for this shop' }, 403)
  const [{ data: s }, { data: st }, { data: items = [] }] = await Promise.all([
    sb.from('shops').select('*').eq('id', o.shop_id).single(),
    sb.from('order_settings').select('*').eq('shop_id', o.shop_id).maybeSingle(),
    sb.from('order_items').select('*').eq('order_id', id).order('created_at'),
  ])
  const set = mergeSettings(st)
  const W = s.paper_width === 80 ? 48 : 32, N = W - 23
  const SOLID = '='.repeat(W), DASH = '-'.repeat(W)
  const no = set.order_prefix + String(o.order_no).padStart(5, '0')
  const money = (n) => Number(n).toFixed(2)
  const rows = []

  rows.push(text(s.name, { bold: 1, align: 1, format: 2 }))
  if (s.tagline) rows.push(text(s.tagline, { bold: 1, align: 1, format: 3 }))
  if (s.address) rows.push(text(s.address, { align: 1 }))
  if (s.mobile) rows.push(text(`Ph: ${s.mobile}`, { align: 1 }))
  if (s.gst_no) rows.push(text(`GSTIN: ${s.gst_no}`, { align: 1 }))
  rows.push(text(SOLID))
  const d = new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  rows.push(text(`Order: ${no}`)); rows.push(text(`Date: ${d}`)); rows.push(text(`Cust: ${o.customer_name}`))
  rows.push(text(SOLID))
  rows.push(text(`${pad('#', 2)} ${pad('Item', N)} ${pad('Qty', 3, true)} ${pad('Rate', 6, true)} ${pad('Amt', 7, true)}`, { bold: 1 }))
  rows.push(text(DASH))
  items.forEach((it, i) => rows.push(text(`${pad(i + 1, 2)} ${pad(it.name, N)} ${pad(Number(it.quantity), 3, true)} ${pad(money(it.unit_price), 6, true)} ${pad(money(it.line_total), 7, true)}`)))
  rows.push(text(SOLID))
  rows.push(text(`Subtotal: Rs.${money(o.subtotal)}`, { align: 2 }))
  if (Number(o.cgst_amt) > 0) rows.push(text(`CGST: Rs.${money(o.cgst_amt)}`, { align: 2 }))
  if (Number(o.sgst_amt) > 0) rows.push(text(`SGST: Rs.${money(o.sgst_amt)}`, { align: 2 }))
  if (Number(o.igst_amt) > 0) rows.push(text(`IGST: Rs.${money(o.igst_amt)}`, { align: 2 }))
  if (Number(o.freight) > 0) rows.push(text(`Freight: Rs.${money(o.freight)}`, { align: 2 }))
  rows.push(text(SOLID))
  rows.push(text(`TOTAL Rs.${money(o.total)}`, { bold: 1, align: 1, format: 3 }))
  rows.push(text(SOLID))
  rows.push(text(`Payment: ${PAY[o.payment_status]}`, { bold: 1, align: 1 }))
  if (o.payment_status === 'partial') rows.push(text(`Received Rs.${money(o.amount_paid)}  Due Rs.${money(Number(o.total) - Number(o.amount_paid))}`, { align: 1 }))
  const base = (set.custom_url || env.APP_URL || '').replace(/\/+$/, '')
  if (base) { rows.push(text('Scan to track your order', { align: 1 })); rows.push({ type: 3, value: `${base}/track/${o.token}`, size: s.paper_width === 80 ? 50 : 38, align: 1 }) }
  rows.push(BLANK)
  rows.push(text(s.thank_you || 'Thank you!', { bold: 1, align: 1, format: 3 }))
  if (s.website) rows.push(text(s.website, { align: 1 }))
  rows.push(BLANK); rows.push(BLANK)

  const payload = {}; rows.forEach((r, i) => { payload[i] = r })
  return json(payload, 200, { 'Access-Control-Allow-Origin': '*' })
}
