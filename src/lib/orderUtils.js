// Shared helpers: stages, tax maths, payment labels, date ranges, links.
export const IST = 'Asia/Kolkata'

// ── Lifecycle ─────────────────────────────────────────────
export const CORE_KEYS = ['received', 'processing', 'ready', 'delivered', 'returned']
export const DEFAULT_STAGES = [
  { key: 'received', label: 'Received' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready to Dispatch' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'returned', label: 'Returned' },
]
export const MAX_EXTRA_STAGES = 2

// Always: received, processing, [up to 2 extra], ready, delivered, returned
export function normStages(list) {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_STAGES
  const label = (k) => (src.find(s => s.key === k)?.label || DEFAULT_STAGES.find(s => s.key === k).label).trim()
  const extras = src.filter(s => !CORE_KEYS.includes(s.key) && s.label?.trim()).slice(0, MAX_EXTRA_STAGES)
    .map(s => ({ key: s.key, label: s.label.trim() }))
  return [
    { key: 'received', label: label('received') }, { key: 'processing', label: label('processing') },
    ...extras,
    { key: 'ready', label: label('ready') }, { key: 'delivered', label: label('delivered') }, { key: 'returned', label: label('returned') },
  ]
}
export const stageLabel = (stages, key) => stages.find(s => s.key === key)?.label || key
export const stageIdx = (stages, key) => Math.max(0, stages.findIndex(s => s.key === key))
export const nextStage = (stages, key) => stages[stageIdx(stages, key) + 1] || null
export const prevStage = (stages, key) => stages[stageIdx(stages, key) - 1] || null
export const STAGE_COLORS = { received: '#3b82f6', processing: '#f59e0b', ready: '#8b5cf6', delivered: '#10b981', returned: '#ef4444' }
export const stageColor = (key) => STAGE_COLORS[key] || '#06b6d4'   // extra stages are cyan

// ── Payment ───────────────────────────────────────────────
export const PAY = {
  unpaid:   { label: 'Unpaid',        bg: '#fee2e2', fg: '#991b1b' },
  partial:  { label: 'Partly paid',   bg: '#fef3c7', fg: '#92400e' },
  paid:     { label: 'Paid',          bg: '#d1fae5', fg: '#065f46' },
  refunded: { label: 'Returned back', bg: '#e5e7eb', fg: '#374151' },
}

// ── Defaults for shop settings ────────────────────────────
export const DEFAULT_SETTINGS = {
  stages: DEFAULT_STAGES, category_label: 'Category', notify_channel: 'whatsapp',
  fields: { category: true, description: false, unit: true, tax: false, freight: true, notes: false },
  tax: { cgst: { on: false, pct: 9 }, sgst: { on: false, pct: 9 }, igst: { on: false, pct: 18 } },
  printer_mode: 'thermal', order_prefix: 'ORD-', custom_url: '', brand_color: '', hide_powered: false,
}
export function mergeSettings(row) {
  const r = row || {}
  return {
    ...DEFAULT_SETTINGS, ...r,
    stages: normStages(r.stages),
    fields: { ...DEFAULT_SETTINGS.fields, ...(r.fields || {}) },
    tax: { cgst: { ...DEFAULT_SETTINGS.tax.cgst, ...(r.tax?.cgst || {}) }, sgst: { ...DEFAULT_SETTINGS.tax.sgst, ...(r.tax?.sgst || {}) }, igst: { ...DEFAULT_SETTINGS.tax.igst, ...(r.tax?.igst || {}) } },
  }
}

// ── Money / tax ───────────────────────────────────────────
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
export const inr = (n) => {
  const num = Number(n || 0)
  return (num < 0 ? '- ₹' : '₹') + Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const rs = (n) => {
  const num = Number(n || 0)
  return (num < 0 ? '- Rs. ' : 'Rs. ') + Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const taxActive = (settings) => !!settings.fields.tax && ['cgst', 'sgst', 'igst'].some(k => settings.tax[k].on)

// percent that applies for one tax on one product: product value if set, else the shop default; 0 if the tax is switched off
export function pctFor(settings, key, product) {
  if (!settings.fields.tax || !settings.tax[key].on) return 0
  const p = product?.[key]
  return p !== null && p !== undefined && p !== '' && Number(p) > 0 ? Number(p) : Number(settings.tax[key].pct) || 0
}

// One line: base = qty * unit price, tax added on top (prices are tax-exclusive)
export function calcLine(it) {
  const base = r2(Number(it.quantity) * Number(it.unit_price))
  const c = r2(base * Number(it.cgst_pct || 0) / 100), s = r2(base * Number(it.sgst_pct || 0) / 100), i = r2(base * Number(it.igst_pct || 0) / 100)
  return { base, cgst: c, sgst: s, igst: i, tax: r2(c + s + i), total: r2(base + c + s + i) }
}
export function calcOrder(items, freight = 0, discountAmt = 0) {
  const t = { subtotal: 0, cgst: 0, sgst: 0, igst: 0 }
  for (const it of items) { const l = calcLine(it); t.subtotal += l.base; t.cgst += l.cgst; t.sgst += l.sgst; t.igst += l.igst }
  const tax = r2(t.cgst + t.sgst + t.igst), f = r2(freight)
  const d = Math.min(Math.max(0, r2(discountAmt)), r2(t.subtotal + tax))
  const total = Math.max(0, r2(t.subtotal + tax - d + f))
  return { subtotal: r2(t.subtotal), cgst: r2(t.cgst), sgst: r2(t.sgst), igst: r2(t.igst), tax, discount: d, freight: f, total }
}
export const orderRowTotals = (t, discount_percent = 0) => ({
  subtotal: t.subtotal, cgst_amt: t.cgst, sgst_amt: t.sgst, igst_amt: t.igst,
  tax_total: t.tax, freight: t.freight, total: t.total,
  discount_amount: t.discount || 0, discount_percent: Number(discount_percent) || 0,
})
export const itemRow = (it) => { const l = calcLine(it); return { quantity: Number(it.quantity), unit_price: Number(it.unit_price), tax_amt: l.tax, line_total: l.base } }

// ── Names, phone numbers, links ───────────────────────────
export const orderNo = (o, s) => (s?.order_prefix ?? 'ORD-') + String(o.order_no || 0).padStart(5, '0')
export const digits10 = (v) => String(v || '').replace(/\D/g, '').slice(-10)
export function waNumber(v) {            // 10 digits -> add India code; longer numbers are kept as typed
  const d = String(v || '').replace(/\D/g, '')
  return d.length === 10 ? '91' + d : d.length > 10 ? d : ''
}
export const appBase = (settings) => (settings?.custom_url?.trim() ? settings.custom_url.trim().replace(/\/+$/, '') : window.location.origin)
export const trackUrl = (o, settings) => `${appBase(settings)}/track/${o.token}`
export const billUrl = (o, settings) => (o.bill_path ? `${appBase(settings)}/api/bill?t=${o.token}` : '')

// ── Dates (all in India time) ─────────────────────────────
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST })
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST })
const istParts = (d = new Date()) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-'); return { y: +p[0], m: +p[1], d: +p[2] } }
const at = (y, m, d) => new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+05:30`)
const addMonth = (y, m, n) => { const t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1] }

export function currentFY() { const { y, m } = istParts(); return m >= 4 ? y : y - 1 }
export const fyLabel = (y) => `FY ${y}-${String(y + 1).slice(2)}`
export const fyOptions = () => Array.from({ length: 6 }, (_, i) => currentFY() - i)
export const yearOptions = () => { const y = istParts().y; return Array.from({ length: 6 }, (_, i) => y - i) }

// mode: all | today | month | lastmonth | pickmonth | year | fy | custom
export function rangeFor(mode, v = {}) {
  const now = istParts()
  if (mode === 'today') return { from: at(now.y, now.m, now.d), to: at(now.y, now.m, now.d + 1) }
  if (mode === 'month') { const [ny, nm] = addMonth(now.y, now.m, 1); return { from: at(now.y, now.m, 1), to: at(ny, nm, 1) } }
  if (mode === 'lastmonth') { const [py, pm] = addMonth(now.y, now.m, -1); return { from: at(py, pm, 1), to: at(now.y, now.m, 1) } }
  if (mode === 'pickmonth' && v.month) { const [y, m] = v.month.split('-').map(Number); const [ny, nm] = addMonth(y, m, 1); return { from: at(y, m, 1), to: at(ny, nm, 1) } }
  if (mode === 'year' && v.year) return { from: at(+v.year, 1, 1), to: at(+v.year + 1, 1, 1) }
  if (mode === 'fy' && v.fy) return { from: at(+v.fy, 4, 1), to: at(+v.fy + 1, 4, 1) }
  if (mode === 'custom' && (v.from || v.to)) {
    const f = v.from ? new Date(v.from + 'T00:00:00+05:30') : null
    const t = v.to ? new Date(new Date(v.to + 'T00:00:00+05:30').getTime() + 864e5) : null
    return { from: f, to: t }
  }
  return null
}
