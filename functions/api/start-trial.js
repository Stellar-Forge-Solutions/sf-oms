// A shop already approved in another Stellar Forge app (Billing / Expense) starts its own 15-day ORDERS trial here.
// One trial per email per product is enforced in the database (trial_ledger).
import { admin, bearer, json, methodNotAllowed } from '../_shared/common.js'

export async function onRequestPost({ request, env }) {
  const sb = admin(env)
  const { data: { user } } = await sb.auth.getUser(bearer(request))
  if (!user) return json({ error: 'Not signed in' }, 401)
  const { data: shop } = await sb.from('shops').select('id,status').eq('owner_id', user.id).maybeSingle()
  if (!shop) return json({ error: 'No shop found for this account' }, 404)
  if (shop.status !== 'approved') return json({ error: 'Your account is not approved yet' }, 403)
  const { error } = await sb.rpc('start_trial', { p_shop: shop.id, p_product: 'orders' })
  if (error) {
    const used = /already used/i.test(error.message)
    return json({ error: used ? 'Your free Orders trial was already used. Please contact Stellar Forge.' : 'Could not start the trial. Please try again.' }, used ? 409 : 500)
  }
  return json({ ok: true })
}
export const onRequest = methodNotAllowed
