import { createClient } from '@supabase/supabase-js'
export const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const validToken = (t) => /^[a-f0-9]{32}$/.test(String(t || ''))
export const publicLogo = (path) => path ? `${process.env.SUPABASE_URL}/storage/v1/object/public/logos/${path}` : null
