// Gives the signed-in shop owner a 5-minute link token for one of THEIR orders (used by the thermal-printer app).
import { admin, bearer, json, readJson, hmacHex, methodNotAllowed } from '../_shared/common.js'

export async function onRequestPost({ request, env }) {
  const sb = admin(env)
  const { data: { user } } = await sb.auth.getUser(bearer(request))
  if (!user) return json({ error: 'Not signed in' }, 401)
  const id = String((await readJson(request)).id || '')
  const { data: shop } = await sb.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
  const { data: order } = await sb.from('orders').select('id,shop_id').eq('id', id).maybeSingle()
  if (!shop || !order || order.shop_id !== shop.id) return json({ error: 'Order not found' }, 404)
  const { data: ok } = await sb.rpc('shop_can_write', { p_shop: shop.id, p_product: 'orders' })
  if (!ok) return json({ error: 'View only' }, 403)
  const exp = Date.now() + 5 * 60e3
  return json({ token: `${exp}.${await hmacHex(env.PRINT_SIGNING_SECRET, `${id}.${exp}`)}` })
}
export const onRequest = methodNotAllowed
