// Shared helpers for Cloudflare Pages Functions (Workers runtime). Secrets come from `env`, never from the browser.
import { createClient } from '@supabase/supabase-js'

export const admin = (env) => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const validToken = (t) => /^[a-f0-9]{32}$/.test(String(t || ''))
export const publicLogo = (env, path) => (path ? `${env.SUPABASE_URL}/storage/v1/object/public/logos/${path}` : null)

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } })
export const text = (msg, status = 200) => new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
export const bearer = (request) => (request.headers.get('Authorization') || '').replace(/^Bearer /, '')
export const readJson = async (request) => { try { return await request.json() } catch { return {} } }
export const methodNotAllowed = () => new Response(null, { status: 405 })

// base64 helpers that work without Node's Buffer
export const b64 = (str) => { const bytes = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
export const b64url = (str) => b64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// HMAC-SHA256 hex + constant-time compare (Web Crypto)
export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
