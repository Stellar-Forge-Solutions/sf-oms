// Write guard + shop helpers. When the trial ends the app becomes view-only.
import { supabase } from './supabase'

let canWriteNow = false
export const setLiveShop = (_shop, writable) => { canWriteNow = !!writable }

export function guardWrite(what = 'This action') {
  if (canWriteNow) return true
  alert(`${what} is unavailable: your trial has ended or the account is on hold. You can still view your orders. Contact Stellar Forge to continue.`)
  return false
}

export const logoUrl = (shop) => shop?.logo_path ? supabase.storage.from('logos').getPublicUrl(shop.logo_path).data.publicUrl : null

const cache = new Map()
export async function toDataUrl(url) {
  if (cache.has(url)) return cache.get(url)
  const blob = await (await fetch(url)).blob()
  const d = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob) })
  cache.set(url, d); return d
}
export async function logoDataUrl(shop) {
  try { const u = logoUrl(shop); return u ? await toDataUrl(u) : null } catch { return null }
}
