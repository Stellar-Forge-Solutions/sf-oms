// Staff management API (1 owner + max 2 staff per shop)
import { admin, bearer, json, readJson, methodNotAllowed } from '../_shared/common.js'

export async function onRequestGet({ request, env }) {
  const sb = admin(env)
  const token = bearer(request)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { data: shop } = await sb.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
  if (!shop) return json({ error: 'Only the shop owner can manage staff' }, 403)

  const { data: staff, error } = await sb
    .from('shop_staff')
    .select('id, name, email, role, created_at')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: true })

  if (error) return json({ error: error.message }, 500)
  return json({ staff: staff || [], count: (staff || []).length, max: 2 })
}

export async function onRequestPost({ request, env }) {
  const sb = admin(env)
  const token = bearer(request)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { data: shop } = await sb.from('shops').select('id, status').eq('owner_id', user.id).maybeSingle()
  if (!shop) return json({ error: 'Only the shop owner can add staff' }, 403)
  if (shop.status !== 'approved') return json({ error: 'Shop is not approved' }, 403)

  // Strictly paid Pro plan only (no trial access for staff logins)
  const { data: ent } = await sb
    .from('entitlements')
    .select('plan, paid_until')
    .eq('shop_id', shop.id)
    .eq('product', 'orders')
    .maybeSingle()

  const isPaidPro = !!ent && ent.plan === 'pro' && !!ent.paid_until && new Date(ent.paid_until) > new Date()
  if (!isPaidPro) {
    return json({ error: 'Staff accounts are exclusively available on the paid Pro plan. Please upgrade to Pro on WhatsApp.' }, 403)
  }

  const body = await readJson(request)
  const name = String(body.name || '').trim().slice(0, 80)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!name) return json({ error: 'Staff name is required' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email address' }, 400)
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)

  // Enforce max 2 staff
  const { count } = await sb
    .from('shop_staff')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)

  if (count >= 2) return json({ error: 'Limit reached: A shop can have a maximum of 2 staff accounts.' }, 400)

  // Create Auth user
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) {
    const isDup = /exist|registered|already/i.test(authErr.message)
    return json({ error: isDup ? 'An account with this email already exists.' : authErr.message }, isDup ? 409 : 500)
  }

  // Insert into shop_staff
  const { data: staffRow, error: staffErr } = await sb
    .from('shop_staff')
    .insert({
      shop_id: shop.id,
      user_id: authUser.user.id,
      email,
      name,
      role: 'staff',
    })
    .select('id, name, email, role, created_at')
    .single()

  if (staffErr) {
    await sb.auth.admin.deleteUser(authUser.user.id)
    return json({ error: staffErr.message }, 500)
  }

  return json({ ok: true, staff: staffRow })
}

export async function onRequestDelete({ request, env }) {
  const sb = admin(env)
  const token = bearer(request)
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { data: shop } = await sb.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
  if (!shop) return json({ error: 'Only the shop owner can remove staff' }, 403)

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'Missing staff id' }, 400)

  const { data: st } = await sb
    .from('shop_staff')
    .select('id, user_id')
    .eq('id', id)
    .eq('shop_id', shop.id)
    .maybeSingle()

  if (!st) return json({ error: 'Staff member not found' }, 404)

  const { error: delErr } = await sb.from('shop_staff').delete().eq('id', id)
  if (delErr) return json({ error: delErr.message }, 500)

  try {
    await sb.auth.admin.deleteUser(st.user_id)
  } catch {}

  return json({ ok: true })
}

export const onRequest = methodNotAllowed
