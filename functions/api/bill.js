// PUBLIC bill access: /api/bill?t=<token>
// - If the shop manually uploaded a file: short-lived signed link to download that file.
// - If auto-generated (or no file uploaded): 302 redirect to the dynamic web invoice /bill/<token> (0 KB storage).
import { admin, validToken, text } from '../_shared/common.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const t = url.searchParams.get('t')
  if (!validToken(t)) return text('Bill not found', 404)
  const sb = admin(env)
  const { data: o } = await sb.from('orders').select('order_no,bill_path,bill_source').eq('token', t).maybeSingle()
  if (!o) return text('Order not found', 404)

  // If a physical file was manually uploaded to storage, serve it directly
  if (o.bill_source === 'uploaded' && o.bill_path) {
    const ext = o.bill_path.split('.').pop()
    const { data, error } = await sb.storage.from('order-bills').createSignedUrl(o.bill_path, 120, { download: `Bill-${String(o.order_no).padStart(5, '0')}.${ext}` })
    if (!error && data?.signedUrl) {
      return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'no-store' } })
    }
  }

  // Otherwise, redirect to the dynamic on-demand web bill (Swiggy / Amazon style, 0 bytes storage)
  return new Response(null, { status: 302, headers: { Location: `/bill/${t}`, 'Cache-Control': 'no-store' } })
}
