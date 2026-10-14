import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/ShopContext'
import { useToast } from '../components/Toast'
import { guardWrite } from '../lib/shop'
import { downloadCustomerSample, readCustomersFile, customerHeaders, exportCustomers } from '../lib/exportUtils'
import { digits10 } from '../lib/orderUtils'

const blank = { name: '', whatsapp: '', email: '', address: '' }

export default function CustomersPage() {
  const { shop, canWrite } = useShop(), toast = useToast(), fileRef = useRef()
  const [list, setList] = useState([]), [loading, setLoading] = useState(true), [q, setQ] = useState('')
  const [edit, setEdit] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)   // parsed Excel rows waiting for confirmation

  const load = async () => {
    try {
      const all = []
      for (let p = 0; p < 5; p++) {
        const { data, error } = await supabase.from('order_customers').select('*').order('name').range(p * 1000, p * 1000 + 999)
        if (error) {
          // If order_customers table does not exist or errors, fall back to orders
          const { data: ords } = await supabase.from('orders').select('customer_name, customer_whatsapp, customer_email').order('created_at', { ascending: false }).limit(500)
          const seen = new Map()
          ;(ords || []).forEach(o => {
            const k = (o.customer_name || '').trim().toLowerCase()
            if (k && !seen.has(k)) {
              seen.set(k, { id: 'ord-' + k, name: o.customer_name.trim(), whatsapp: o.customer_whatsapp || '', email: o.customer_email || '', address: '' })
            }
          })
          setList([...seen.values()])
          setLoading(false)
          return
        }
        all.push(...(data || []))
        if ((data || []).length < 1000) break
      }
      setList(all)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const shown = list.filter(c => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return (c.name || '').toLowerCase().includes(s) ||
           (c.whatsapp || '').includes(s) ||
           (c.email || '').toLowerCase().includes(s)
  })

  const save = async () => {
    setErr('')
    if (!edit.name.trim()) return setErr('Customer name is required')
    if (edit.whatsapp && digits10(edit.whatsapp).length !== 10) return setErr('WhatsApp number should have 10 digits (or leave it empty)')
    if (edit.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(edit.email.trim())) return setErr('Email looks wrong (or leave it empty)')
    if (!guardWrite('Saving customers')) return

    const row = {
      name: edit.name.trim(),
      whatsapp: edit.whatsapp ? digits10(edit.whatsapp) : null,
      email: edit.email?.trim().toLowerCase() || null,
      address: edit.address?.trim() || null,
    }

    setBusy(true)
    const isEdit = edit.id && !String(edit.id).startsWith('ord-')
    const { error } = isEdit
      ? await supabase.from('order_customers').update(row).eq('id', edit.id)
      : await supabase.from('order_customers').insert({ ...row, shop_id: shop.id })
    setBusy(false)

    if (error) return setErr(error.code === '23505' ? 'A customer with this name already exists' : error.message)
    setEdit(null); toast('Customer saved'); load()
  }

  const del = async (c) => {
    if (!guardWrite('Deleting customers') || !confirm(`Delete customer “${c.name}”? Existing orders will keep their customer details.`)) return
    if (String(c.id).startsWith('ord-')) {
      toast('Customer deleted'); load(); return
    }
    const { error } = await supabase.from('order_customers').delete().eq('id', c.id)
    if (error) return toast(error.message, 'error')
    toast('Customer deleted'); load()
  }

  const pickFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const { rows, skipped } = await readCustomersFile(file)
      if (!rows.length) return toast('No valid rows found. Download the sample file to see the format.', 'error')
      const seen = new Map(); rows.forEach(r => seen.set(r.name.toLowerCase(), r))     // same name twice in file: last row wins
      const uniq = [...seen.values()]
      const exist = new Map(list.filter(c => !String(c.id).startsWith('ord-')).map(c => [c.name.toLowerCase(), c.id]))
      setPreview({
        rows: uniq,
        skipped,
        fresh: uniq.filter(r => !exist.has(r.name.toLowerCase())).length,
        update: uniq.filter(r => exist.has(r.name.toLowerCase())).length,
        exist,
      })
    } catch (x) { toast('Could not read the file: ' + x.message, 'error') }
  }

  const doImport = async () => {
    if (!guardWrite('Importing customers')) return
    setBusy(true)
    const toIns = [], toUpd = []
    for (const r of preview.rows) {
      const id = preview.exist.get(r.name.toLowerCase())
      id ? toUpd.push({ ...r, id, shop_id: shop.id }) : toIns.push({ ...r, shop_id: shop.id })
    }
    let error = null
    for (let i = 0; i < toIns.length && !error; i += 500) error = (await supabase.from('order_customers').insert(toIns.slice(i, i + 500))).error
    for (let i = 0; i < toUpd.length && !error; i += 500) error = (await supabase.from('order_customers').upsert(toUpd.slice(i, i + 500), { onConflict: 'id' })).error
    setBusy(false)
    if (error) return toast('Import failed: ' + error.message, 'error')
    toast(`Imported: ${toIns.length} new, ${toUpd.length} updated`); setPreview(null); load()
  }

  const f = (k, label, props = {}) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" value={edit[k] ?? ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} {...props} />
    </div>
  )

  return (
    <div className="page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Saved customers auto-fill WhatsApp and email when creating an order.</p>
        </div>
        <button className="btn btn-primary" disabled={!canWrite} onClick={() => { setErr(''); setEdit({ ...blank }) }}>+ Add customer</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <div className="section-title" style={{ margin: 0 }}>Import & Export</div>
          {!!shown.length && (
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCustomers('xlsx', shown, shop?.name || 'customers')}>
                📊 Export Excel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCustomers('csv', shown, shop?.name || 'customers')}>
                📄 Export CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCustomers('pdf', shown, shop?.name || 'customers')}>
                📑 Export PDF
              </button>
            </div>
          )}
        </div>
        <p className="text-muted" style={{ marginBottom: 10 }}>Columns: {customerHeaders().join(', ')}. Customers with the same name are updated.</p>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadCustomerSample}>⬇️ Download sample file</button>
          <button className="btn btn-dark btn-sm" disabled={!canWrite} onClick={() => fileRef.current.click()}>⬆️ Import Excel / CSV</button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={pickFile} />
        </div>
      </div>

      <input className="form-input" placeholder="Search customer name, phone, or email…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {loading && <div className="empty-state">Loading…</div>}
      {!loading && !shown.length && (
        <div className="card empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">{list.length ? 'No match' : 'No customers yet'}</div>
          <div className="empty-state-text">Add one, or import your customer list from Excel.</div>
        </div>
      )}

      {!!shown.length && (
        <div className="card" style={{ padding: '4px 16px' }}>
          {shown.map(c => (
            <div className="item-row" key={c.id}>
              <div style={{ minWidth: 0 }}>
                <b>{c.name}</b>
                <div className="text-muted" style={{ fontSize: '.78rem' }}>
                  {[c.whatsapp && `WhatsApp: ${c.whatsapp}`, c.email, c.address].filter(Boolean).join(' · ') || 'No contact details'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="flex gap-2 mt-1" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canWrite} onClick={() => { setErr(''); setEdit({ ...c }) }}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={!canWrite} onClick={() => del(c)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{edit.id ? 'Edit customer' : 'Add customer'}</div>
            <div className="modal-subtitle">&nbsp;</div>
            {f('name', 'Customer name *', { placeholder: 'e.g. Ravi Kumar', autoFocus: true })}
            <div className="grid2">
              {f('whatsapp', 'WhatsApp (optional)', { placeholder: '10-digit number', inputMode: 'numeric' })}
              {f('email', 'Email (optional)', { placeholder: 'name@example.com', type: 'email' })}
            </div>
            {f('address', 'Address / Notes (optional)', { placeholder: 'City, area or shop address' })}
            {err && <div className="err-text">✕ {err}</div>}
            <div className="flex gap-2 mt-3">
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save customer'}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Ready to import</div>
            <div className="modal-subtitle">
              {preview.fresh} new · {preview.update} will be updated{preview.skipped ? ` · ${preview.skipped} rows skipped (missing name)` : ''}
            </div>
            <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 12 }}>
              {preview.rows.slice(0, 8).map(r => (
                <div className="item-row" key={r.name}>
                  <span><b>{r.name}</b> <span className="text-muted">{[r.whatsapp, r.email].filter(Boolean).join(' · ')}</span></span>
                </div>
              ))}
              {preview.rows.length > 8 && <div className="text-muted mt-2">…and {preview.rows.length - 8} more</div>}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={doImport}>{busy ? 'Importing…' : 'Import now'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
