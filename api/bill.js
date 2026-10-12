// PUBLIC bill download: /api/bill?t=<token> -> short-lived signed link to the stored bill file.
import { admin, validToken } from './_lib/common.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const t = String(req.query.t || '')
  if (!validToken(t)) return res.status(404).send('Bill not found')
  const sb = admin()
  const { data: o } = await sb.from('orders').select('order_no,bill_path,shop_id').eq('token', t).maybeSingle()
  if (!o?.bill_path) return res.status(404).send('No bill has been added to this order yet.')
  const ext = o.bill_path.split('.').pop()
  const { data, error } = await sb.storage.from('order-bills').createSignedUrl(o.bill_path, 120, { download: `Bill-${String(o.order_no).padStart(5, '0')}.${ext}` })
  if (error || !data?.signedUrl) return res.status(500).send('Could not open the bill. Please try again.')
  res.redirect(302, data.signedUrl)
}
