// Printing an order: (1) Bluetooth thermal printer via the Thermer / "Bluetooth Print" app,
// (2) normal printer via the browser's own print window (see printNormal.js).
// The thermal app opens a deep link, then fetches the receipt JSON from /api/print-bill
// with a short-lived signed token requested here using the user's login.
import { supabase } from './supabase'
import { guardWrite } from './shop'

export async function bluetoothPrint(order) {
  if (!guardWrite('Printing')) return
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/print-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ id: order.id }),
  })
  if (!r.ok) { alert('Could not start printing. Please try again.'); return }
  const { token } = await r.json()
  const apiUrl = `${window.location.origin}/api/print-bill?id=${order.id}&t=${token}`
  window.location.href = `my.bluetoothprint.scheme://${apiUrl}`
}
