import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../components/Toast'
import PlanCard from '../components/PlanCard'
import { logoUrl } from '../lib/shop'
import { contactUrl } from '../lib/plans'
import { CORE_KEYS, MAX_EXTRA_STAGES, normStages } from '../lib/orderUtils'

const SHOP_KEYS = ['name', 'tagline', 'address', 'mobile', 'whatsapp', 'gst_no', 'website', 'thank_you']
const FIELD_LABELS = [['category', 'Category'], ['description', 'Description'], ['unit', 'Unit'], ['tax', 'Tax (GST)'], ['freight', 'Freight / delivery charges'], ['notes', 'Order notes']]

function resizeLogo(file, max = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(b => b ? resolve(b) : reject(new Error('Bad image')), 'image/png')
    }; img.onerror = () => reject(new Error('Not an image')); img.src = URL.createObjectURL(file)
  })
}

export default function SettingsPage() {
  const { shop, settings, canWrite, isPro, hasExpense, reload } = useShop(), { user } = useAuth(), toast = useToast()
  const [sf, setSf] = useState(() => Object.fromEntries(SHOP_KEYS.map(k => [k, shop?.[k] ?? ''])))
  const [paper, setPaper] = useState(shop?.paper_width || 58)
  const [s, setS] = useState(() => ({
    category_label: settings.category_label, order_prefix: settings.order_prefix, notify_channel: settings.notify_channel, printer_mode: settings.printer_mode,
    fields: { ...settings.fields }, tax: JSON.parse(JSON.stringify(settings.tax)),
    custom_url: settings.custom_url || '', brand_color: settings.brand_color || '', hide_powered: !!settings.hide_powered,
  }))
  const [core, setCore] = useState(() => Object.fromEntries(settings.stages.filter(x => CORE_KEYS.includes(x.key)).map(x => [x.key, x.label])))
  const [extras, setExtras] = useState(() => settings.stages.filter(x => !CORE_KEYS.includes(x.key)))
  const [busy, setBusy] = useState(false)

  const setShop = (k) => (e) => setSf({ ...sf, [k]: e.target.value })
  const inp = (label, k, props = {}) => <div className="form-group"><label className="form-label">{label}</label><input className="form-input" value={sf[k]} onChange={setShop(k)} {...props} /></div>
  const toggleField = (k) => setS({ ...s, fields: { ...s.fields, [k]: !s.fields[k] } })
  const setTax = (k, patch) => setS({ ...s, tax: { ...s.tax, [k]: { ...s.tax[k], ...patch } } })
  const logo = logoUrl(shop)

  const save = async () => {
    if (!sf.name.trim()) return toast('Shop name is required', 'error')
    const mobile = sf.mobile.replace(/\D/g, '').slice(-10)
    if (mobile.length !== 10) return toast('Enter a 10-digit mobile number', 'error')
    const labels = [...Object.values(core), ...extras.map(x => x.label)]
    if (labels.some(l => !l.trim() || l.trim().length > 30)) return toast('Every status needs a name (up to 30 characters)', 'error')
    if (new Set(labels.map(l => l.trim().toLowerCase())).size !== labels.length) return toast('Status names must be different from each other', 'error')
    if (s.fields.tax && !['cgst', 'sgst', 'igst'].some(k => s.tax[k].on)) return toast('Tax is on: tick at least one tax (CGST, SGST or IGST)', 'error')
    for (const k of ['cgst', 'sgst', 'igst']) { const p = Number(s.tax[k].pct); if (s.tax[k].on && !(p >= 0 && p <= 100)) return toast(`${k.toUpperCase()} percent must be between 0 and 100`, 'error') }
    if (!/^[A-Za-z0-9-]{0,8}$/.test(s.order_prefix)) return toast('Order prefix: up to 8 letters, digits or -', 'error')
    if (s.custom_url && !/^https:\/\/[^\s]+$/i.test(s.custom_url.trim())) return toast('Custom URL must start with https://', 'error')
    setBusy(true)

    const stages = normStages([...Object.entries(core).map(([key, label]) => ({ key, label })), ...extras])
    const removed = settings.stages.filter(x => !CORE_KEYS.includes(x.key) && !stages.some(n => n.key === x.key))
    for (const r of removed) await supabase.from('orders').update({ stage_key: 'processing' }).eq('stage_key', r.key).eq('shop_id', shop.id)   // orders in a deleted stage fall back to Processing

    const clean = (v) => (typeof v === 'string' ? v.trim() || null : v)
    const shopRow = { ...Object.fromEntries(SHOP_KEYS.map(k => [k, clean(sf[k])])), name: sf.name.trim(), mobile, whatsapp: (sf.whatsapp || mobile).replace(/\D/g, '').slice(-10), thank_you: sf.thank_you.trim() || 'Thank you!', paper_width: Number(paper) }
    const e1 = (await supabase.from('shops').update(shopRow).eq('id', shop.id)).error
    const e2 = (await supabase.from('order_settings').upsert({
      shop_id: shop.id, stages, category_label: s.category_label.trim() || 'Category', notify_channel: s.notify_channel, fields: s.fields, tax: s.tax,
      printer_mode: s.printer_mode, order_prefix: s.order_prefix.trim().toUpperCase(),
      ...(isPro ? { custom_url: s.custom_url.trim() || null, brand_color: s.brand_color.trim() || null, hide_powered: s.hide_powered } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id' })).error
    setBusy(false)
    if (e1 || e2) return toast('Could not save: ' + (e1 || e2).message, 'error')
    toast('Settings saved'); reload()
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const blob = await resizeLogo(file); const path = `${shop.id}/logo-${Date.now()}.png`
      const up = await supabase.storage.from('logos').upload(path, blob, { contentType: 'image/png' }); if (up.error) throw up.error
      const { error } = await supabase.from('shops').update({ logo_path: path }).eq('id', shop.id); if (error) throw error
      toast('Logo updated'); reload()
    } catch (x) { toast('Logo upload failed: ' + x.message, 'error') }
  }

  const toggleSync = async (on) => {
    const { error } = await supabase.rpc('set_orders_sales_sync', { p_on: on })
    if (error) return toast(error.message, 'error')
    toast(on ? 'Delivered orders now appear as sales in Expense Tracker' : 'Sales sync switched off'); reload()
  }
  const addExtra = () => setExtras([...extras, { key: 'x' + Date.now().toString(36), label: '' }])
  const H = ({ children, sub }) => <><h3 style={{ marginTop: 22, marginBottom: sub ? 2 : 10 }}>{children}</h3>{sub && <p className="text-muted" style={{ marginBottom: 10 }}>{sub}</p>}</>

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>Changes apply to new orders and messages.</p>
      <PlanCard />

      <div className="card">
        <H>Shop details</H>
        {inp('Shop name', 'name')}{inp('Second line (tagline)', 'tagline')}{inp('Address', 'address')}
        <div className="grid2">{inp('Mobile', 'mobile', { inputMode: 'numeric' })}{inp('WhatsApp', 'whatsapp', { inputMode: 'numeric' })}</div>
        <div className="grid2">{inp('GST number (optional)', 'gst_no')}{inp('Website (optional)', 'website')}</div>
        {inp('Thank-you text (bill and messages)', 'thank_you')}
        <div className="form-group"><label className="form-label">Logo (bill, tracking page, email)</label>
          {logo && <img src={logo} alt="" style={{ height: 60, display: 'block', marginBottom: 8 }} />}
          <input type="file" accept="image/*" onChange={upload} disabled={!canWrite} /></div>

        <H sub="Rename them to suit your shop (for example: Order placed, Packing, Out for delivery). You can add up to 2 more stages between Processing and Ready.">Order statuses</H>
        {[['received', '1'], ['processing', '2']].map(([k, n]) => <div className="form-group" key={k}><label className="form-label">Status {n}</label><input className="form-input" maxLength={30} value={core[k]} onChange={e => setCore({ ...core, [k]: e.target.value })} /></div>)}
        {extras.map((x, i) => (
          <div className="form-group" key={x.key}><label className="form-label">Extra status {i + 1}</label>
            <div className="flex gap-2"><input className="form-input" maxLength={30} placeholder="e.g. Packing" value={x.label} onChange={e => setExtras(extras.map(y => y.key === x.key ? { ...y, label: e.target.value } : y))} />
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => confirm('Remove this status? Orders in it move back to Processing.') && setExtras(extras.filter(y => y.key !== x.key))}>✕</button></div></div>))}
        {extras.length < MAX_EXTRA_STAGES && <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }} onClick={addExtra}>+ Add a status after Processing</button>}
        {[['ready', '3'], ['delivered', '4'], ['returned', '5']].map(([k, n]) => <div className="form-group" key={k}><label className="form-label">Status {n + (extras.length ? ` (+${extras.length})` : '')}</label><input className="form-input" maxLength={30} value={core[k]} onChange={e => setCore({ ...core, [k]: e.target.value })} /></div>)}

        <H>Names</H>
        <div className="grid2">
          <div className="form-group"><label className="form-label">What do you call “Category”?</label><input className="form-input" maxLength={24} placeholder="Masala, Car Type…" value={s.category_label} onChange={e => setS({ ...s, category_label: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Order number prefix</label><input className="form-input" maxLength={8} value={s.order_prefix} onChange={e => setS({ ...s, order_prefix: e.target.value })} /></div>
        </div>

        <H sub="Untick what you do not need. They disappear from the new-order screen.">Fields on the new-order page</H>
        {FIELD_LABELS.map(([k, l]) => <label className="toggle-row" key={k}><input type="checkbox" checked={!!s.fields[k]} onChange={() => toggleField(k)} />{k === 'category' ? s.category_label || l : l}</label>)}
        {s.fields.tax && <div className="hint-box mt-3" style={{ borderStyle: 'solid' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Which taxes do you charge, and at what percent?</div>
          {['cgst', 'sgst', 'igst'].map(k => (
            <div className="toggle-row" key={k} style={{ borderBottom: 0 }}>
              <input type="checkbox" checked={s.tax[k].on} onChange={e => setTax(k, { on: e.target.checked })} /><span style={{ width: 52, fontWeight: 600 }}>{k.toUpperCase()}</span>
              <input className="form-input" style={{ maxWidth: 110, padding: '8px 10px' }} type="number" inputMode="decimal" min="0" max="100" step="any" disabled={!s.tax[k].on} value={s.tax[k].pct} onChange={e => setTax(k, { pct: e.target.value })} /><span>%</span>
            </div>))}
          <div style={{ fontSize: '.75rem', marginTop: 6 }}>Prices are taken as tax-exclusive; tax is added on top. A product’s own % (from Excel) overrides these.</div>
        </div>}

        <H sub="After you change an order's status you get a pop-up to send the update.">Customer notification</H>
        <div className="seg">{[['whatsapp', 'WhatsApp'], ['email', 'Email'], ['both', 'Both']].map(([k, l]) => <button key={k} className={s.notify_channel === k ? 'on' : ''} onClick={() => setS({ ...s, notify_channel: k })}>{l}</button>)}</div>

        <H sub="Choose how the Print buttons behave by default. Both options are always on the order page.">Printing</H>
        <div className="seg" style={{ marginBottom: 12 }}>{[['thermal', 'Thermal printer'], ['normal', 'Normal printer']].map(([k, l]) => <button key={k} className={s.printer_mode === k ? 'on' : ''} onClick={() => setS({ ...s, printer_mode: k })}>{l}</button>)}</div>
        <div className="form-group"><label className="form-label">Thermal printer paper</label>
          <select className="form-input" value={paper} onChange={e => setPaper(e.target.value)}><option value={58}>2 inch (58 mm)</option><option value={80}>3 inch (80 mm)</option></select></div>
        <Link to="/connect-printer" className="btn btn-secondary btn-sm">🖨️ How to connect a thermal printer</Link>

        {hasExpense && <>
          <H sub="Each day, the value of orders marked Delivered is added to your Expense Tracker as one sale. Returned orders are taken out again.">Expense Tracker</H>
          <label className="toggle-row"><input type="checkbox" checked={!!shop.sync_orders_sales} disabled={!canWrite} onChange={e => toggleSync(e.target.checked)} />Send delivered orders to Expense Tracker as sales</label>
        </>}

        <H>Pro features{!isPro && <span className="pro-tag">PRO</span>}</H>
        <div className={isPro ? '' : 'lock'}>
          <div className="form-group"><label className="form-label">Custom URL for tracking links</label><input className="form-input" placeholder="https://orders.yourshop.com" value={s.custom_url} onChange={e => setS({ ...s, custom_url: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Brand colour (tracking page, email)</label>
            <div className="flex gap-2"><input type="color" value={s.brand_color || '#00c9a7'} onChange={e => setS({ ...s, brand_color: e.target.value })} style={{ width: 52, height: 44, border: '1.5px solid var(--border)', borderRadius: 8 }} /><input className="form-input" placeholder="#00c9a7" value={s.brand_color} onChange={e => setS({ ...s, brand_color: e.target.value })} /></div></div>
          <label className="toggle-row"><input type="checkbox" checked={s.hide_powered} onChange={e => setS({ ...s, hide_powered: e.target.checked })} />Hide “Powered by Stellar Forge”</label>
        </div>
        <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
          {!isPro && <a className="btn btn-dark btn-sm" target="_blank" rel="noopener noreferrer" href={contactUrl('Orders Pro plan', shop, user)}>⭐ Upgrade to Pro</a>}
          <a className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href={contactUrl('multiple logins for my team (Orders Pro)', shop, user)}>👥 Multiple logins: contact us</a>
          <a className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href={contactUrl('dedicated infrastructure (Orders Pro)', shop, user)}>🏗️ Dedicated infra: contact us</a>
        </div>

        <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 24 }} onClick={save} disabled={busy || !canWrite}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </div>
  )
}
