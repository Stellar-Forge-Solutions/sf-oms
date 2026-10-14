// PUBLIC order tracking data. No login: the random token in the link is the key.
// Only customer-safe fields are returned (no phone, email, notes or internal ids).
import { admin, validToken, publicLogo, json } from '../_shared/common.js'
import { mergeSettings } from '../../src/lib/orderUtils.js'

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t')
  if (!validToken(t)) return json({ error: 'Order not found' }, 404)
  const sb = admin(env)
  const { data: o } = await sb.from('orders').select('*').eq('token', t).maybeSingle()
  if (!o) return json({ error: 'Order not found' }, 404)
  const [{ data: shop }, { data: st }, { data: items }, { data: events }] = await Promise.all([
    sb.from('shops').select('name,tagline,address,mobile,whatsapp,website,gst_no,thank_you,logo_path').eq('id', o.shop_id).single(),
    sb.from('order_settings').select('*').eq('shop_id', o.shop_id).maybeSingle(),
    sb.from('order_items').select('name,category,description,unit,quantity,unit_price,tax_amt,line_total').eq('order_id', o.id).order('created_at'),
    sb.from('order_events').select('stage_key,created_at').eq('order_id', o.id).order('created_at'),
  ])
  const s = mergeSettings(st)
  return json({
    shop: { name: shop.name, tagline: shop.tagline, address: shop.address, mobile: shop.mobile, whatsapp: shop.whatsapp, website: shop.website, gst_no: shop.gst_no, thank_you: shop.thank_you, logo: publicLogo(env, shop.logo_path) },
    brand: { color: s.brand_color || null, hide_powered: !!s.hide_powered },
    stages: s.stages, category_label: s.category_label, fields: s.fields,
    order: {
      no: s.order_prefix + String(o.order_no).padStart(5, '0'), customer_name: o.customer_name, created_at: o.created_at, stage_key: o.stage_key, payment_status: o.payment_status,
      amount_paid: o.amount_paid, subtotal: o.subtotal, cgst_amt: o.cgst_amt, sgst_amt: o.sgst_amt, igst_amt: o.igst_amt, freight: o.freight,
      discount_percent: o.discount_percent || 0, discount_amount: o.discount_amount || 0,
      total: o.total, has_bill: !!o.bill_path, tracking_url: o.tracking_url || null, notes: o.notes || null,
      delivery_date: o.delivery_date || null,
    },
    items, events,
  })
}
