// PUBLIC bill download: /api/bill?t=<token> -> short-lived signed link to the stored bill file.
import { admin, validToken, text } from '../_shared/common.js'

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t')
  if (!validToken(t)) return text('Bill not found', 404)
  const sb = admin(env)
  const { data: o } = await sb.from('orders').select('order_no,bill_path').eq('token', t).maybeSingle()
  if (!o?.bill_path) return text('No bill has been added to this order yet.', 404)
  const ext = o.bill_path.split('.').pop()
  const { data, error } = await sb.storage.from('order-bills').createSignedUrl(o.bill_path, 120, { download: `Bill-${String(o.order_no).padStart(5, '0')}.${ext}` })
  if (error || !data?.signedUrl) return text('Could not open the bill. Please try again.', 500)
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'no-store' } })
}
