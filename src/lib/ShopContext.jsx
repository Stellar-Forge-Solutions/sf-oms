import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { setLiveShop } from './shop'
import { mergeSettings } from './orderUtils'
import { getPlan, can, getMonthBounds, calculateOverage } from './planHelper'

const Ctx = createContext({})
export const useShop = () => useContext(Ctx)
export const PRODUCT = 'orders'

export function ShopProvider({ children }) {
  const { session } = useAuth()
  const [st, setSt] = useState({
    loading: true,
    shop: null,
    ent: null,
    plan: getPlan(null, null),
    canWrite: false,
    settings: mergeSettings(null),
    monthlyUsage: { used: 0, included: 100, pctUsed: 0, overageOrders: 0, overageAmount: 0, overageLimit: 100, isNearLimit: false, isAtLimit: false, isOverageBlocked: false, remainingIncluded: 100 },
    isPro: false,
    isPaidPro: false,
    isOwner: true,
    isStaff: false,
    role: 'owner',
    can: (feat) => false,
  })

  const load = useCallback(async () => {
    if (!session) {
      setLiveShop(null, false)
      return setSt(s => ({
        ...s,
        loading: false,
        shop: null,
        ent: null,
        plan: getPlan(null, null),
        canWrite: false,
        isPro: false,
        isPaidPro: false,
        isOwner: false,
        isStaff: false,
        role: '',
        monthlyUsage: calculateOverage(0, getPlan(null, null), 100),
        can: () => false,
      }))
    }

    const { data: shop } = await supabase.from('shops').select('*').maybeSingle()
    const { data: ents } = await supabase.from('entitlements').select('*')
    const ent = (ents || []).find(e => e.product === PRODUCT) || null
    const exp = (ents || []).find(e => e.product === 'expenses')
    const { data: row } = shop ? await supabase.from('order_settings').select('*').eq('shop_id', shop.id).maybeSingle() : { data: null }

    const plan = getPlan(shop, ent)

    // Per-shop overage rate stored in DB (set by admin per entitlement row)
    const dbOverageRate = ent?.overage_rate != null ? Number(ent.overage_rate) : null

    // Calculate monthly orders + revenue for the shop (IST calendar month)
    let monthlyOrdersCount = 0
    let monthlyGrossRevenue = 0
    let monthlyCollectedRevenue = 0
    if (shop) {
      const { from, to } = getMonthBounds()
      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('total, amount_paid')
        .eq('shop_id', shop.id)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
      monthlyOrdersCount = (monthlyOrders || []).length
      monthlyGrossRevenue = (monthlyOrders || []).reduce((s, o) => s + (Number(o.total) || 0), 0)
      monthlyCollectedRevenue = (monthlyOrders || []).reduce((s, o) => s + (Number(o.amount_paid) || 0), 0)
    }

    const overageLimit = shop?.monthly_overage_limit !== undefined ? shop.monthly_overage_limit : 100
    const usage = calculateOverage(monthlyOrdersCount, plan, overageLimit, dbOverageRate)

    const isOwner = !!shop && shop.owner_id === session?.user?.id
    const isStaff = !isOwner && !!shop
    const role = isOwner ? 'owner' : 'staff'
    const isPro = plan.key === 'pro'
    const isPaidPro = isPro // in the new tiering system, pro plan shops have pro features

    // An approved shop has canWrite = true if not suspended or rejected
    // (Existing orders are ALWAYS editable; new order creation checks isOverageBlocked in OrderForm)
    const canWrite = !!shop && shop.status === 'approved'

    setLiveShop(shop, canWrite)

    setSt({
      loading: false,
      shop,
      ent,
      plan,
      monthlyUsage: usage,
      can: (feature) => can(shop, feature, ent),
      hasExpense: !!exp,
      canWrite,
      settings: mergeSettings(row),
      isPro,
      isPaidPro,
      isOwner,
      isStaff,
      role,
      // Monthly revenue figures available to any component via useShop()
      monthlyRevenue: {
        gross: monthlyGrossRevenue,
        collected: monthlyCollectedRevenue,
        outstanding: monthlyGrossRevenue - monthlyCollectedRevenue,
      },
    })
  }, [session?.user?.id])

  useEffect(() => { setSt(s => ({ ...s, loading: true })); load() }, [load])
  return <Ctx.Provider value={{ ...st, reload: load }}>{children}</Ctx.Provider>
}

