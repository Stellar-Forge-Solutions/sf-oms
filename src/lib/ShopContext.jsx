import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { setLiveShop } from './shop'
import { mergeSettings } from './orderUtils'

const Ctx = createContext({})
export const useShop = () => useContext(Ctx)
export const PRODUCT = 'orders'

export function ShopProvider({ children }) {
  const { session } = useAuth()
  const [st, setSt] = useState({ loading: true, shop: null, ent: null, canWrite: false, settings: mergeSettings(null), isPro: false })

  const load = useCallback(async () => {
    if (!session) { setLiveShop(null, false); return setSt(s => ({ ...s, loading: false, shop: null, ent: null, canWrite: false })) }
    const { data: shop } = await supabase.from('shops').select('*').maybeSingle()
    const { data: ent } = await supabase.from('entitlements').select('*').eq('product', PRODUCT).maybeSingle()
    const { data: row } = shop ? await supabase.from('order_settings').select('*').eq('shop_id', shop.id).maybeSingle() : { data: null }
    const now = Date.now()
    const active = !!ent && ((ent.trial_ends_at && new Date(ent.trial_ends_at) > now) || (ent.paid_until && new Date(ent.paid_until) > now))
    const canWrite = !!shop && shop.status === 'approved' && active
    const paid = !!ent?.paid_until && new Date(ent.paid_until) > now
    setLiveShop(shop, canWrite)
    setSt({ loading: false, shop, ent, canWrite, settings: mergeSettings(row), isPro: ent?.plan === 'pro' && paid })
  }, [session?.user?.id])

  useEffect(() => { setSt(s => ({ ...s, loading: true })); load() }, [load])
  return <Ctx.Provider value={{ ...st, reload: load }}>{children}</Ctx.Provider>
}
