// Gives the signed-in shop owner a 5-minute link token for one of THEIR orders.
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const jwt = (req.headers.authorization || '').replace(/^Bearer /, '')
  const { data: { user } } = await sb.auth.getUser(jwt)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  const id = String(req.body?.id || '')
  const { data: shop } = await sb.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
  const { data: bill } = await sb.from('orders').select('id,shop_id').eq('id', id).maybeSingle()
  if (!shop || !bill || bill.shop_id !== shop.id) return res.status(404).json({ error: 'Order not found' })
  const { data: ok } = await sb.rpc('shop_can_write', { p_shop: shop.id, p_product: 'orders' })
  if (!ok) return res.status(403).json({ error: 'View only' })
  const exp = Date.now() + 5 * 60e3
  const sig = createHmac('sha256', process.env.PRINT_SIGNING_SECRET).update(`${id}.${exp}`).digest('hex')
  res.json({ token: `${exp}.${sig}` })
}
